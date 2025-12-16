import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ConversationList } from '@/components/ConversationList';
import { ChatWindow } from '@/components/ChatWindow';
import Navbar from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import { DynamicBreadcrumbs } from '@/components/DynamicBreadcrumbs';

interface Conversation {
  id: string;
  property_id: string;
  property_title?: string;
  other_user_name?: string;
}

const MessagesPage = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const conversationId = searchParams.get('conversation');
    if (conversationId) {
      // Si hay un ID en la URL, seleccionar esa conversación
      setSelectedConversation({ id: conversationId } as Conversation);
      setShowMobileChat(true);
    }
  }, [searchParams]);

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowMobileChat(true);
  };

  const handleBackToList = () => {
    setShowMobileChat(false);
    setSelectedConversation(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-6 md:py-8 px-4 pb-24 md:pb-8">
        {/* Breadcrumbs */}
        <DynamicBreadcrumbs 
          items={[
            { label: 'Inicio', href: '/', active: false },
            { label: 'Mensajes', href: '', active: true }
          ]} 
          className="mb-4" 
        />

        <div className="mb-4 md:mb-6">
          <Button variant="ghost" onClick={() => navigate('/')} className="mb-2 md:mb-4 h-11">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Inicio
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">Mensajes</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Conversa con agentes sobre propiedades de tu interés
          </p>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:grid md:grid-cols-3 gap-6 h-[calc(100vh-16rem)]">
          {/* Lista de conversaciones */}
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="p-4 border-b bg-muted/50">
              <h2 className="font-semibold flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Conversaciones
              </h2>
            </div>
            <ConversationList
              selectedId={selectedConversation?.id}
              onSelect={handleSelectConversation}
            />
          </div>

          {/* Ventana de chat */}
          <div className="col-span-2 border rounded-lg bg-card overflow-hidden">
            {selectedConversation ? (
              <ChatWindow
                conversationId={selectedConversation.id}
                propertyTitle={selectedConversation.property_title}
                propertyId={selectedConversation.property_id}
                otherUserName={selectedConversation.other_user_name}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    Selecciona una conversación
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Elige una conversación de la lista para comenzar a chatear
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden">
          {!showMobileChat ? (
            <div className="border rounded-lg bg-card overflow-hidden h-[calc(100vh-14rem)]">
              <div className="p-4 border-b bg-muted/50">
                <h2 className="font-semibold flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Conversaciones
                </h2>
              </div>
              <ConversationList
                selectedId={selectedConversation?.id}
                onSelect={handleSelectConversation}
              />
            </div>
          ) : (
            <div className="border rounded-lg bg-card overflow-hidden h-[calc(100vh-14rem)]">
              <div className="p-4 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToList}
                  className="mb-2"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Volver a conversaciones
                </Button>
              </div>
              {selectedConversation && (
                <ChatWindow
                  conversationId={selectedConversation.id}
                  propertyTitle={selectedConversation.property_title}
                  propertyId={selectedConversation.property_id}
                  otherUserName={selectedConversation.other_user_name}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
