import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Send, Home, Check, CheckCheck, Search, X, ChevronUp, ChevronDown, Image as ImageIcon, Paperclip } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { ImageLightbox } from './ImageLightbox';
import { z } from 'zod';
import { useMonitoring } from '@/lib/monitoring';

// Message content validation schema (max 5000 characters)
const messageSchema = z.object({
  content: z.string()
    .max(5000, 'El mensaje no puede exceder 5000 caracteres')
    .refine((val) => val.trim().length > 0, 'El mensaje no puede estar vacío')
});

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at?: string | null;
  message_type: 'text' | 'image';
  image_url?: string | null;
}

interface PresenceState {
  user_id: string;
  typing: boolean;
  online_at: string;
}

interface ChatWindowProps {
  conversationId: string;
  propertyTitle?: string;
  propertyId?: string;
  otherUserName?: string;
}

export const ChatWindow = ({
  conversationId,
  propertyTitle,
  propertyId,
  otherUserName,
}: ChatWindowProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const messageRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const { error: logError, warn, captureException } = useMonitoring();

  useEffect(() => {
    if (!conversationId || !user) return;

    fetchMessages();
    markAsRead();

    // Suscribirse a nuevos mensajes en tiempo real
    const messagesChannel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, {
            ...newMsg,
            message_type: newMsg.message_type as 'text' | 'image'
          }]);
          
          // Marcar como leído si el mensaje es de otro usuario
          if (newMsg.sender_id !== user.id) {
            markAsRead();
            
            // Enviar notificación por email si el usuario no está viendo la ventana
            if (document.hidden) {
              sendEmailNotification(newMsg);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedMsg = payload.new as Message;
          // Actualizar el mensaje en la lista cuando se marca como leído
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === updatedMsg.id ? {
                ...updatedMsg,
                message_type: updatedMsg.message_type as 'text' | 'image'
              } : msg
            )
          );
        }
      )
      .subscribe();

    // Canal de presencia para estado de "escribiendo..."
    const presenceChannel = supabase.channel(`presence:${conversationId}`, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<PresenceState>();
        
        // Buscar si el otro usuario está escribiendo
        const otherUsers = Object.keys(state).filter((key) => key !== user.id);
        const isTyping = otherUsers.some((userId) => {
          const userPresence = state[userId];
          return userPresence?.[0]?.typing === true;
        });
        
        setIsOtherUserTyping(isTyping);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            user_id: user.id,
            typing: false,
            online_at: new Date().toISOString(),
          });
        }
      });

    presenceChannelRef.current = presenceChannel;

    return () => {
      supabase.removeChannel(messagesChannel);
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, user]);

  // Auto-scroll al final cuando hay nuevos mensajes (solo si no hay búsqueda activa)
  useEffect(() => {
    if (!searchQuery) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, searchQuery]);

  // Buscar mensajes cuando cambia el query
  useEffect(() => {
    if (searchQuery.trim()) {
      const results = messages
        .filter((msg) =>
          msg.content.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .map((msg) => msg.id);
      
      setSearchResults(results);
      setCurrentSearchIndex(0);
      
      // Scroll al primer resultado
      if (results.length > 0) {
        scrollToMessage(results[0]);
      }
    } else {
      setSearchResults([]);
      setCurrentSearchIndex(0);
    }
  }, [searchQuery, messages]);

  const scrollToMessage = (messageId: string) => {
    const messageElement = messageRefs.current[messageId];
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleNextResult = () => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    scrollToMessage(searchResults[nextIndex]);
  };

  const handlePreviousResult = () => {
    if (searchResults.length === 0) return;
    const prevIndex = currentSearchIndex === 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    setCurrentSearchIndex(prevIndex);
    scrollToMessage(searchResults[prevIndex]);
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) => {
      if (part.toLowerCase() === query.toLowerCase()) {
        return (
          <mark key={index} className="bg-yellow-300 rounded px-0.5">
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  // Manejar selección de imagen
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen');
      return;
    }

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede ser mayor a 5MB');
      return;
    }

    setSelectedImage(file);
    
    // Crear preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Limpiar imagen seleccionada
  const clearSelectedImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast.error('Solo se permiten archivos de imagen');
      return;
    }

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede ser mayor a 5MB');
      return;
    }

    setSelectedImage(file);
    
    // Crear preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Subir imagen a storage
  const uploadImage = async (file: File): Promise<string | null> => {
    if (!user) return null;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('message-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Generar signed URL con expiración de 1 año (máximo permitido)
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from('message-images')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 año en segundos

      if (urlError) throw urlError;

      return signedUrlData.signedUrl;
    } catch (error) {
      logError('Error uploading image to chat', {
        component: 'ChatWindow',
        error,
      });
      captureException(error as Error, {
        component: 'ChatWindow',
        action: 'uploadImage',
      });
      toast.error('Error al subir la imagen');
      return null;
    }
  };

  // Generar signed URL para una imagen existente
  const getSignedUrl = async (imageUrl: string): Promise<string> => {
    try {
      // Extraer el path del archivo de la URL
      const url = new URL(imageUrl);
      const pathMatch = imageUrl.match(/message-images\/(.+)$/);
      
      if (!pathMatch) return imageUrl;
      
      const filePath = pathMatch[1];
      
      const { data, error } = await supabase.storage
        .from('message-images')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 año

      if (error) {
        warn('Error creating signed URL', {
          component: 'ChatWindow',
          error,
        });
        return imageUrl;
      }

      return data.signedUrl;
    } catch (error) {
      warn('Error generating signed URL', {
        component: 'ChatWindow',
        error,
      });
      return imageUrl;
    }
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Generar signed URLs para imágenes
      const messagesWithSignedUrls = await Promise.all(
        (data || []).map(async (msg) => {
          if (msg.message_type === 'image' && msg.image_url) {
            const signedUrl = await getSignedUrl(msg.image_url);
            return {
              ...msg,
              message_type: msg.message_type as 'text' | 'image',
              image_url: signedUrl
            };
          }
          return {
            ...msg,
            message_type: msg.message_type as 'text' | 'image'
          };
        })
      );
      
      setMessages(messagesWithSignedUrls);
    } catch (error) {
      logError('Error fetching chat messages', {
        component: 'ChatWindow',
        conversationId,
        error,
      });
      captureException(error as Error, {
        component: 'ChatWindow',
        action: 'fetchMessages',
        conversationId,
      });
      toast.error('Error al cargar los mensajes');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!user) return;

    try {
      // Llamar a la función de base de datos para marcar mensajes como leídos
      const { error } = await supabase.rpc('mark_messages_as_read', {
        p_conversation_id: conversationId,
        p_user_id: user.id,
      });

      if (error) throw error;

      // También actualizar el contador de no leídos
      await supabase
        .from('conversation_participants')
        .update({
          unread_count: 0,
          last_read_at: new Date().toISOString(),
        })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    } catch (error) {
      warn('Error marking messages as read', {
        component: 'ChatWindow',
        conversationId,
        error,
      });
    }
  };

  // Enviar notificación por email
  const sendEmailNotification = async (message: Message) => {
    if (!user) return;

    try {
      // Obtener información de la conversación para saber quién es el receptor
      const { data: conversation } = await supabase
        .from('conversations')
        .select('buyer_id, agent_id')
        .eq('id', conversationId)
        .single();

      if (!conversation) return;

      const recipientId = conversation.buyer_id === user.id 
        ? conversation.agent_id 
        : conversation.buyer_id;

      await supabase.functions.invoke('send-message-notification', {
        body: {
          recipientId,
          senderName: otherUserName || 'Usuario',
          messageContent: message.content,
          messageType: message.message_type,
          conversationId,
          propertyTitle,
        },
      });
    } catch (error) {
      warn('Error sending email notification', {
        component: 'ChatWindow',
        conversationId,
        error,
      });
    }
  };

  // Función para notificar que el usuario está escribiendo
  const notifyTyping = useCallback(async (isTyping: boolean) => {
    if (!user || !presenceChannelRef.current) return;

    try {
      await presenceChannelRef.current.track({
        user_id: user.id,
        typing: isTyping,
        online_at: new Date().toISOString(),
      });
    } catch (error) {
      warn('Error updating typing status', {
        component: 'ChatWindow',
        error,
      });
    }
  }, [user]);

  // Manejar cambios en el textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    
    // Enforce character limit client-side
    if (value.length > 5000) {
      toast.error('El mensaje no puede exceder 5000 caracteres');
      return;
    }
    
    setNewMessage(value);

    // Notificar que está escribiendo
    notifyTyping(true);

    // Limpiar timeout anterior
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Establecer nuevo timeout para dejar de notificar
    typingTimeoutRef.current = setTimeout(() => {
      notifyTyping(false);
    }, 2000); // Deja de notificar después de 2 segundos de inactividad
  };

  const handleSend = async () => {
    if (!user) return;
    
    // Validar que haya contenido o imagen
    if (!newMessage.trim() && !selectedImage) return;

    // Validate message content before sending
    try {
      if (newMessage.trim()) {
        messageSchema.parse({ content: newMessage.trim() });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    // Limpiar estado de "escribiendo"
    notifyTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    setSending(true);
    try {
      let imageUrl: string | null = null;

      // Si hay imagen, subirla primero
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
        if (!imageUrl) {
          throw new Error('Failed to upload image');
        }
      }

      // Insertar mensaje
      const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: newMessage.trim() || '',
          message_type: selectedImage ? 'image' : 'text',
          image_url: imageUrl,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      setNewMessage('');
      clearSelectedImage();
    } catch (error) {
      logError('Error sending message', {
        component: 'ChatWindow',
        conversationId,
        error,
      });
      captureException(error as Error, {
        component: 'ChatWindow',
        action: 'sendMessage',
        conversationId,
      });
      toast.error('Error al enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Cargando mensajes...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="p-4 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-lg">{otherUserName}</h2>
            </div>
            {propertyTitle && (
              <p className="text-sm text-muted-foreground truncate">{propertyTitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSearch(!showSearch)}
              className={showSearch ? 'bg-accent' : ''}
            >
              <Search className="w-4 h-4" />
            </Button>
            {propertyId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/propiedad/${propertyId}`)}
              >
                <Home className="w-4 h-4 mr-2" />
                Ver Propiedad
              </Button>
            )}
          </div>
        </div>

        {/* Barra de búsqueda */}
        {showSearch && (
          <div className="px-4 pb-4 border-t">
            <div className="flex items-center gap-2 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar en la conversación..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                  autoFocus
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              {searchResults.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {currentSearchIndex + 1} de {searchResults.length}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handlePreviousResult}
                      disabled={searchResults.length === 0}
                      className="h-8 w-8"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleNextResult}
                      disabled={searchResults.length === 0}
                      className="h-8 w-8"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              
              {searchQuery && searchResults.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  Sin resultados
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-center">
              No hay mensajes todavía.<br />
              ¡Envía el primero!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwn = message.sender_id === user?.id;
              const isRead = message.read_at !== null && message.read_at !== undefined;
              const isSearchResult = searchResults.includes(message.id);
              const isCurrentSearchResult = searchResults[currentSearchIndex] === message.id;
              
              return (
                <div
                  key={message.id}
                  ref={(el) => (messageRefs.current[message.id] = el)}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${
                    isCurrentSearchResult ? 'animate-pulse' : ''
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 transition-all ${
                      isOwn
                        ? 'bg-primary/10 text-foreground border border-primary/20'
                        : 'bg-muted text-foreground'
                    } ${
                      isCurrentSearchResult
                        ? 'ring-2 ring-yellow-400 ring-offset-2'
                        : isSearchResult
                        ? 'ring-1 ring-yellow-300'
                        : ''
                    }`}
                  >
                    {/* Mostrar imagen si es un mensaje de imagen */}
                    {message.message_type === 'image' && message.image_url && (
                      <div 
                        className="mb-2 cursor-pointer rounded-lg overflow-hidden"
                        onClick={() => setLightboxImage(message.image_url!)}
                      >
                        <img
                          src={message.image_url}
                          alt="Imagen compartida"
                          className="max-w-full max-h-64 object-cover rounded-lg hover:opacity-90 transition-opacity"
                        />
                      </div>
                    )}
                    
                    {/* Mostrar texto si existe */}
                    {message.content && (
                      <p className="whitespace-pre-wrap break-words">
                        {searchQuery ? highlightText(message.content, searchQuery) : message.content}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <p
                        className={`text-xs text-muted-foreground`}
                      >
                        {formatDistanceToNow(new Date(message.created_at), {
                          addSuffix: true,
                          locale: es,
                        })}
                      </p>
                      
                      {/* Confirmación de lectura - solo para mensajes propios */}
                      {isOwn && (
                        <div className="flex-shrink-0">
                          {isRead ? (
                            <CheckCheck 
                              className="w-4 h-4 text-primary"
                            />
                          ) : (
                            <Check 
                              className="w-4 h-4 text-muted-foreground"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Indicador de "escribiendo..." */}
            {isOtherUserTyping && (
              <div className="flex justify-start">
                <div className="bg-muted text-foreground rounded-lg p-3 max-w-[70%]">
                  <div className="flex items-center gap-1">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm text-muted-foreground ml-2">escribiendo...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t bg-card p-4">
        {/* Preview de imagen seleccionada */}
        {imagePreview && (
          <div className="mb-3 relative inline-block">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-32 rounded-lg border"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
              onClick={clearSelectedImage}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Zona de drag & drop */}
        <div
          className={`relative ${isDragging ? 'ring-2 ring-primary' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-10 pointer-events-none">
              <div className="text-center">
                <ImageIcon className="w-12 h-12 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">Suelta la imagen aquí</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {/* Botón de adjuntar imagen */}
            <input
              type="file"
              id="image-upload"
              accept="image/*"
              className="hidden"
              onChange={handleImageSelect}
              disabled={sending}
            />
            <label htmlFor="image-upload">
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={sending}
                asChild
              >
                <span>
                  <Paperclip className="w-4 h-4" />
                </span>
              </Button>
            </label>

            <Textarea
              value={newMessage}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={selectedImage ? "Agrega un mensaje (opcional)..." : "Escribe un mensaje..."}
              className="min-h-[60px] max-h-[120px]"
              disabled={sending}
            />
            <Button
              onClick={handleSend}
              disabled={(!newMessage.trim() && !selectedImage) || sending}
              size="icon"
              className="shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Presiona Enter para enviar, Shift+Enter para nueva línea • Arrastra imágenes aquí
        </p>
      </div>

      {/* Lightbox para ver imágenes */}
      {lightboxImage && (
        <ImageLightbox
          images={[{ url: lightboxImage }]}
          initialIndex={0}
          isOpen={true}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
};
