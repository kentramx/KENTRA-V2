/**
 * Lista completa de códigos de país para WhatsApp
 * Incluye información de validación y formato para cada país
 */

export interface CountryCode {
  code: string; // Código ISO del país (ej: "MX", "US")
  name: string; // Nombre del país en español
  dialCode: string; // Código de marcación internacional (ej: "+52")
  flag: string; // Emoji de bandera
  placeholder: string; // Ejemplo de número sin código de país
  minLength: number; // Longitud mínima del número (sin código de país)
  maxLength: number; // Longitud máxima del número (sin código de país)
  pattern: RegExp; // Patrón de validación para el número local
}

export const COUNTRY_CODES: CountryCode[] = [
  // México (por defecto)
  {
    code: "MX",
    name: "México",
    dialCode: "+52",
    flag: "🇲🇽",
    placeholder: "5512345678",
    minLength: 10,
    maxLength: 10,
    pattern: /^[1-9]\d{9}$/
  },
  
  // Norteamérica
  {
    code: "US",
    name: "Estados Unidos",
    dialCode: "+1",
    flag: "🇺🇸",
    placeholder: "2025551234",
    minLength: 10,
    maxLength: 10,
    pattern: /^[2-9]\d{9}$/
  },
  {
    code: "CA",
    name: "Canadá",
    dialCode: "+1",
    flag: "🇨🇦",
    placeholder: "4165551234",
    minLength: 10,
    maxLength: 10,
    pattern: /^[2-9]\d{9}$/
  },

  // América Latina (ordenado alfabéticamente)
  {
    code: "AR",
    name: "Argentina",
    dialCode: "+54",
    flag: "🇦🇷",
    placeholder: "1123456789",
    minLength: 10,
    maxLength: 11,
    pattern: /^\d{10,11}$/
  },
  {
    code: "BO",
    name: "Bolivia",
    dialCode: "+591",
    flag: "🇧🇴",
    placeholder: "71234567",
    minLength: 8,
    maxLength: 8,
    pattern: /^\d{8}$/
  },
  {
    code: "BR",
    name: "Brasil",
    dialCode: "+55",
    flag: "🇧🇷",
    placeholder: "11987654321",
    minLength: 10,
    maxLength: 11,
    pattern: /^\d{10,11}$/
  },
  {
    code: "CL",
    name: "Chile",
    dialCode: "+56",
    flag: "🇨🇱",
    placeholder: "912345678",
    minLength: 9,
    maxLength: 9,
    pattern: /^[2-9]\d{8}$/
  },
  {
    code: "CO",
    name: "Colombia",
    dialCode: "+57",
    flag: "🇨🇴",
    placeholder: "3001234567",
    minLength: 10,
    maxLength: 10,
    pattern: /^[13]\d{9}$/
  },
  {
    code: "CR",
    name: "Costa Rica",
    dialCode: "+506",
    flag: "🇨🇷",
    placeholder: "87654321",
    minLength: 8,
    maxLength: 8,
    pattern: /^\d{8}$/
  },
  {
    code: "CU",
    name: "Cuba",
    dialCode: "+53",
    flag: "🇨🇺",
    placeholder: "51234567",
    minLength: 8,
    maxLength: 8,
    pattern: /^[5-8]\d{7}$/
  },
  {
    code: "DO",
    name: "República Dominicana",
    dialCode: "+1",
    flag: "🇩🇴",
    placeholder: "8091234567",
    minLength: 10,
    maxLength: 10,
    pattern: /^[2-9]\d{9}$/
  },
  {
    code: "EC",
    name: "Ecuador",
    dialCode: "+593",
    flag: "🇪🇨",
    placeholder: "991234567",
    minLength: 9,
    maxLength: 9,
    pattern: /^[2-9]\d{8}$/
  },
  {
    code: "SV",
    name: "El Salvador",
    dialCode: "+503",
    flag: "🇸🇻",
    placeholder: "71234567",
    minLength: 8,
    maxLength: 8,
    pattern: /^[267]\d{7}$/
  },
  {
    code: "GT",
    name: "Guatemala",
    dialCode: "+502",
    flag: "🇬🇹",
    placeholder: "51234567",
    minLength: 8,
    maxLength: 8,
    pattern: /^[2-7]\d{7}$/
  },
  {
    code: "HN",
    name: "Honduras",
    dialCode: "+504",
    flag: "🇭🇳",
    placeholder: "91234567",
    minLength: 8,
    maxLength: 8,
    pattern: /^\d{8}$/
  },
  {
    code: "NI",
    name: "Nicaragua",
    dialCode: "+505",
    flag: "🇳🇮",
    placeholder: "81234567",
    minLength: 8,
    maxLength: 8,
    pattern: /^\d{8}$/
  },
  {
    code: "PA",
    name: "Panamá",
    dialCode: "+507",
    flag: "🇵🇦",
    placeholder: "61234567",
    minLength: 8,
    maxLength: 8,
    pattern: /^[46]\d{7}$/
  },
  {
    code: "PY",
    name: "Paraguay",
    dialCode: "+595",
    flag: "🇵🇾",
    placeholder: "961234567",
    minLength: 9,
    maxLength: 9,
    pattern: /^9\d{8}$/
  },
  {
    code: "PE",
    name: "Perú",
    dialCode: "+51",
    flag: "🇵🇪",
    placeholder: "987654321",
    minLength: 9,
    maxLength: 9,
    pattern: /^[9]\d{8}$/
  },
  {
    code: "PR",
    name: "Puerto Rico",
    dialCode: "+1",
    flag: "🇵🇷",
    placeholder: "7871234567",
    minLength: 10,
    maxLength: 10,
    pattern: /^[2-9]\d{9}$/
  },
  {
    code: "UY",
    name: "Uruguay",
    dialCode: "+598",
    flag: "🇺🇾",
    placeholder: "94123456",
    minLength: 8,
    maxLength: 8,
    pattern: /^9\d{7}$/
  },
  {
    code: "VE",
    name: "Venezuela",
    dialCode: "+58",
    flag: "🇻🇪",
    placeholder: "4121234567",
    minLength: 10,
    maxLength: 10,
    pattern: /^4\d{9}$/
  },

  // Europa
  {
    code: "ES",
    name: "España",
    dialCode: "+34",
    flag: "🇪🇸",
    placeholder: "612345678",
    minLength: 9,
    maxLength: 9,
    pattern: /^[6-9]\d{8}$/
  },
  {
    code: "FR",
    name: "Francia",
    dialCode: "+33",
    flag: "🇫🇷",
    placeholder: "612345678",
    minLength: 9,
    maxLength: 9,
    pattern: /^[1-9]\d{8}$/
  },
  {
    code: "DE",
    name: "Alemania",
    dialCode: "+49",
    flag: "🇩🇪",
    placeholder: "15123456789",
    minLength: 10,
    maxLength: 11,
    pattern: /^1[5-7]\d{8,9}$/
  },
  {
    code: "IT",
    name: "Italia",
    dialCode: "+39",
    flag: "🇮🇹",
    placeholder: "3123456789",
    minLength: 9,
    maxLength: 10,
    pattern: /^3\d{8,9}$/
  },
  {
    code: "GB",
    name: "Reino Unido",
    dialCode: "+44",
    flag: "🇬🇧",
    placeholder: "7400123456",
    minLength: 10,
    maxLength: 10,
    pattern: /^[1-9]\d{9}$/
  },
  {
    code: "PT",
    name: "Portugal",
    dialCode: "+351",
    flag: "🇵🇹",
    placeholder: "912345678",
    minLength: 9,
    maxLength: 9,
    pattern: /^[29]\d{8}$/
  },
  {
    code: "NL",
    name: "Países Bajos",
    dialCode: "+31",
    flag: "🇳🇱",
    placeholder: "612345678",
    minLength: 9,
    maxLength: 9,
    pattern: /^6\d{8}$/
  },
  {
    code: "BE",
    name: "Bélgica",
    dialCode: "+32",
    flag: "🇧🇪",
    placeholder: "470123456",
    minLength: 9,
    maxLength: 9,
    pattern: /^4\d{8}$/
  },
  {
    code: "CH",
    name: "Suiza",
    dialCode: "+41",
    flag: "🇨🇭",
    placeholder: "781234567",
    minLength: 9,
    maxLength: 9,
    pattern: /^[7-9]\d{8}$/
  },

  // Asia
  {
    code: "CN",
    name: "China",
    dialCode: "+86",
    flag: "🇨🇳",
    placeholder: "13812345678",
    minLength: 11,
    maxLength: 11,
    pattern: /^1[3-9]\d{9}$/
  },
  {
    code: "JP",
    name: "Japón",
    dialCode: "+81",
    flag: "🇯🇵",
    placeholder: "9012345678",
    minLength: 10,
    maxLength: 10,
    pattern: /^[7-9]\d{9}$/
  },
  {
    code: "KR",
    name: "Corea del Sur",
    dialCode: "+82",
    flag: "🇰🇷",
    placeholder: "1012345678",
    minLength: 9,
    maxLength: 10,
    pattern: /^1[0-9]\d{7,8}$/
  },
  {
    code: "IN",
    name: "India",
    dialCode: "+91",
    flag: "🇮🇳",
    placeholder: "9876543210",
    minLength: 10,
    maxLength: 10,
    pattern: /^[6-9]\d{9}$/
  },
  {
    code: "PH",
    name: "Filipinas",
    dialCode: "+63",
    flag: "🇵🇭",
    placeholder: "9171234567",
    minLength: 10,
    maxLength: 10,
    pattern: /^9\d{9}$/
  },

  // Otros
  {
    code: "AU",
    name: "Australia",
    dialCode: "+61",
    flag: "🇦🇺",
    placeholder: "412345678",
    minLength: 9,
    maxLength: 9,
    pattern: /^4\d{8}$/
  },
  {
    code: "NZ",
    name: "Nueva Zelanda",
    dialCode: "+64",
    flag: "🇳🇿",
    placeholder: "211234567",
    minLength: 8,
    maxLength: 10,
    pattern: /^[2-9]\d{7,9}$/
  }
];

/**
 * Obtiene información de un país por su código
 */
export const getCountryByCode = (code: string): CountryCode => {
  const country = COUNTRY_CODES.find(c => c.code === code);
  return country || COUNTRY_CODES[0]; // Default a México
};

/**
 * Detecta el país a partir del número completo con código de país
 */
export const detectCountryFromNumber = (fullNumber: string): string => {
  if (!fullNumber) return "MX";
  
  const cleaned = fullNumber.replace(/\D/g, '');
  
  // Ordenar por longitud de dialCode (más largo primero) para evitar conflictos
  // Ej: +1 vs +1234
  const sortedCountries = [...COUNTRY_CODES].sort((a, b) => 
    b.dialCode.replace('+', '').length - a.dialCode.replace('+', '').length
  );
  
  for (const country of sortedCountries) {
    const prefix = country.dialCode.replace('+', '');
    if (cleaned.startsWith(prefix)) {
      // Verificar que el número restante tenga la longitud correcta
      const localNumber = cleaned.slice(prefix.length);
      if (localNumber.length >= country.minLength && localNumber.length <= country.maxLength) {
        return country.code;
      }
    }
  }
  
  return "MX"; // Default a México
};

/**
 * Extrae el número local (sin código de país) de un número completo
 */
export const extractLocalNumber = (fullNumber: string, countryCode: string): string => {
  const country = getCountryByCode(countryCode);
  const cleaned = fullNumber.replace(/\D/g, '');
  const prefix = country.dialCode.replace('+', '');
  
  if (cleaned.startsWith(prefix)) {
    return cleaned.slice(prefix.length);
  }
  
  return cleaned;
};
