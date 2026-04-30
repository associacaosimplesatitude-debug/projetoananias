import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  persistRevistaToken,
  getValidRevistaSession,
  clearRevistaSession,
  saveRevistaSession,
} from "@/lib/revistaSession";
import logoCentralGospel from "@/assets/logo_central_gospel.png";

type Country = {
  code: string;
  flag: string;
  ddi: string;
  label: string;
  maxDigits: number;
  minDigits: number;
  placeholder: string;
};

// Defaults genéricos (E.164): número nacional entre 6 e 15 dígitos.
const GENERIC_PLACEHOLDER = "Número de telefone";

const COUNTRIES: Country[] = [
  // Países com regras específicas (BR sempre primeiro = padrão)
  { code: "BR", flag: "🇧🇷", ddi: "55", label: "Brasil", maxDigits: 11, minDigits: 10, placeholder: "(11) 99999-9999" },
  { code: "PT", flag: "🇵🇹", ddi: "351", label: "Portugal", maxDigits: 9, minDigits: 9, placeholder: "913 603 081" },
  { code: "US", flag: "🇺🇸", ddi: "1", label: "Estados Unidos", maxDigits: 10, minDigits: 10, placeholder: "(212) 555-1234" },
  // Demais países (ordem alfabética por nome em PT)
  { code: "AF", flag: "🇦🇫", ddi: "93", label: "Afeganistão", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "ZA", flag: "🇿🇦", ddi: "27", label: "África do Sul", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "AL", flag: "🇦🇱", ddi: "355", label: "Albânia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "DE", flag: "🇩🇪", ddi: "49", label: "Alemanha", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "AD", flag: "🇦🇩", ddi: "376", label: "Andorra", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "AO", flag: "🇦🇴", ddi: "244", label: "Angola", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "AI", flag: "🇦🇮", ddi: "1264", label: "Anguilla", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "AQ", flag: "🇦🇶", ddi: "672", label: "Antártida", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "AG", flag: "🇦🇬", ddi: "1268", label: "Antígua e Barbuda", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SA", flag: "🇸🇦", ddi: "966", label: "Arábia Saudita", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "DZ", flag: "🇩🇿", ddi: "213", label: "Argélia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "AR", flag: "🇦🇷", ddi: "54", label: "Argentina", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "AM", flag: "🇦🇲", ddi: "374", label: "Armênia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "AW", flag: "🇦🇼", ddi: "297", label: "Aruba", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "AU", flag: "🇦🇺", ddi: "61", label: "Austrália", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "AT", flag: "🇦🇹", ddi: "43", label: "Áustria", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "AZ", flag: "🇦🇿", ddi: "994", label: "Azerbaijão", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BS", flag: "🇧🇸", ddi: "1242", label: "Bahamas", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BH", flag: "🇧🇭", ddi: "973", label: "Bahrein", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BD", flag: "🇧🇩", ddi: "880", label: "Bangladesh", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BB", flag: "🇧🇧", ddi: "1246", label: "Barbados", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BE", flag: "🇧🇪", ddi: "32", label: "Bélgica", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BZ", flag: "🇧🇿", ddi: "501", label: "Belize", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BJ", flag: "🇧🇯", ddi: "229", label: "Benin", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BM", flag: "🇧🇲", ddi: "1441", label: "Bermudas", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BY", flag: "🇧🇾", ddi: "375", label: "Bielorrússia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BO", flag: "🇧🇴", ddi: "591", label: "Bolívia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BA", flag: "🇧🇦", ddi: "387", label: "Bósnia e Herzegovina", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BW", flag: "🇧🇼", ddi: "267", label: "Botsuana", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BN", flag: "🇧🇳", ddi: "673", label: "Brunei", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BG", flag: "🇧🇬", ddi: "359", label: "Bulgária", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BF", flag: "🇧🇫", ddi: "226", label: "Burkina Faso", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BI", flag: "🇧🇮", ddi: "257", label: "Burundi", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BT", flag: "🇧🇹", ddi: "975", label: "Butão", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CV", flag: "🇨🇻", ddi: "238", label: "Cabo Verde", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CM", flag: "🇨🇲", ddi: "237", label: "Camarões", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "KH", flag: "🇰🇭", ddi: "855", label: "Camboja", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CA", flag: "🇨🇦", ddi: "1", label: "Canadá", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "QA", flag: "🇶🇦", ddi: "974", label: "Catar", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "KZ", flag: "🇰🇿", ddi: "7", label: "Cazaquistão", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "TD", flag: "🇹🇩", ddi: "235", label: "Chade", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CL", flag: "🇨🇱", ddi: "56", label: "Chile", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CN", flag: "🇨🇳", ddi: "86", label: "China", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CY", flag: "🇨🇾", ddi: "357", label: "Chipre", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CO", flag: "🇨🇴", ddi: "57", label: "Colômbia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "KM", flag: "🇰🇲", ddi: "269", label: "Comores", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CG", flag: "🇨🇬", ddi: "242", label: "Congo", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CD", flag: "🇨🇩", ddi: "243", label: "Congo (RDC)", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "KP", flag: "🇰🇵", ddi: "850", label: "Coreia do Norte", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "KR", flag: "🇰🇷", ddi: "82", label: "Coreia do Sul", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CI", flag: "🇨🇮", ddi: "225", label: "Costa do Marfim", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CR", flag: "🇨🇷", ddi: "506", label: "Costa Rica", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "HR", flag: "🇭🇷", ddi: "385", label: "Croácia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CU", flag: "🇨🇺", ddi: "53", label: "Cuba", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CW", flag: "🇨🇼", ddi: "599", label: "Curaçao", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "DK", flag: "🇩🇰", ddi: "45", label: "Dinamarca", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "DJ", flag: "🇩🇯", ddi: "253", label: "Djibuti", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "DM", flag: "🇩🇲", ddi: "1767", label: "Dominica", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "EG", flag: "🇪🇬", ddi: "20", label: "Egito", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SV", flag: "🇸🇻", ddi: "503", label: "El Salvador", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "AE", flag: "🇦🇪", ddi: "971", label: "Emirados Árabes Unidos", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "EC", flag: "🇪🇨", ddi: "593", label: "Equador", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "ER", flag: "🇪🇷", ddi: "291", label: "Eritreia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SK", flag: "🇸🇰", ddi: "421", label: "Eslováquia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SI", flag: "🇸🇮", ddi: "386", label: "Eslovênia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "ES", flag: "🇪🇸", ddi: "34", label: "Espanha", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "EE", flag: "🇪🇪", ddi: "372", label: "Estônia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "ET", flag: "🇪🇹", ddi: "251", label: "Etiópia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "FJ", flag: "🇫🇯", ddi: "679", label: "Fiji", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "PH", flag: "🇵🇭", ddi: "63", label: "Filipinas", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "FI", flag: "🇫🇮", ddi: "358", label: "Finlândia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "FR", flag: "🇫🇷", ddi: "33", label: "França", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GA", flag: "🇬🇦", ddi: "241", label: "Gabão", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GM", flag: "🇬🇲", ddi: "220", label: "Gâmbia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GH", flag: "🇬🇭", ddi: "233", label: "Gana", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GE", flag: "🇬🇪", ddi: "995", label: "Geórgia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GI", flag: "🇬🇮", ddi: "350", label: "Gibraltar", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GD", flag: "🇬🇩", ddi: "1473", label: "Granada", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GR", flag: "🇬🇷", ddi: "30", label: "Grécia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GL", flag: "🇬🇱", ddi: "299", label: "Groenlândia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GP", flag: "🇬🇵", ddi: "590", label: "Guadalupe", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GU", flag: "🇬🇺", ddi: "1671", label: "Guam", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GT", flag: "🇬🇹", ddi: "502", label: "Guatemala", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GY", flag: "🇬🇾", ddi: "592", label: "Guiana", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GF", flag: "🇬🇫", ddi: "594", label: "Guiana Francesa", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GN", flag: "🇬🇳", ddi: "224", label: "Guiné", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GQ", flag: "🇬🇶", ddi: "240", label: "Guiné Equatorial", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GW", flag: "🇬🇼", ddi: "245", label: "Guiné-Bissau", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "HT", flag: "🇭🇹", ddi: "509", label: "Haiti", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "NL", flag: "🇳🇱", ddi: "31", label: "Holanda", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "HN", flag: "🇭🇳", ddi: "504", label: "Honduras", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "HK", flag: "🇭🇰", ddi: "852", label: "Hong Kong", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "HU", flag: "🇭🇺", ddi: "36", label: "Hungria", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "YE", flag: "🇾🇪", ddi: "967", label: "Iêmen", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BV", flag: "🇧🇻", ddi: "47", label: "Ilha Bouvet", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "IM", flag: "🇮🇲", ddi: "44", label: "Ilha de Man", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CX", flag: "🇨🇽", ddi: "61", label: "Ilha Christmas", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "KY", flag: "🇰🇾", ddi: "1345", label: "Ilhas Cayman", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CC", flag: "🇨🇨", ddi: "61", label: "Ilhas Cocos", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CK", flag: "🇨🇰", ddi: "682", label: "Ilhas Cook", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "FO", flag: "🇫🇴", ddi: "298", label: "Ilhas Faroé", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "FK", flag: "🇫🇰", ddi: "500", label: "Ilhas Malvinas", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MP", flag: "🇲🇵", ddi: "1670", label: "Ilhas Marianas do Norte", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MH", flag: "🇲🇭", ddi: "692", label: "Ilhas Marshall", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "PN", flag: "🇵🇳", ddi: "64", label: "Ilhas Pitcairn", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SB", flag: "🇸🇧", ddi: "677", label: "Ilhas Salomão", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "TC", flag: "🇹🇨", ddi: "1649", label: "Ilhas Turcas e Caicos", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "VG", flag: "🇻🇬", ddi: "1284", label: "Ilhas Virgens Britânicas", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "VI", flag: "🇻🇮", ddi: "1340", label: "Ilhas Virgens Americanas", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "IN", flag: "🇮🇳", ddi: "91", label: "Índia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "ID", flag: "🇮🇩", ddi: "62", label: "Indonésia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "IR", flag: "🇮🇷", ddi: "98", label: "Irã", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "IQ", flag: "🇮🇶", ddi: "964", label: "Iraque", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "IE", flag: "🇮🇪", ddi: "353", label: "Irlanda", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "IS", flag: "🇮🇸", ddi: "354", label: "Islândia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "IL", flag: "🇮🇱", ddi: "972", label: "Israel", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "IT", flag: "🇮🇹", ddi: "39", label: "Itália", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "JM", flag: "🇯🇲", ddi: "1876", label: "Jamaica", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "JP", flag: "🇯🇵", ddi: "81", label: "Japão", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "JE", flag: "🇯🇪", ddi: "44", label: "Jersey", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "JO", flag: "🇯🇴", ddi: "962", label: "Jordânia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "KW", flag: "🇰🇼", ddi: "965", label: "Kuwait", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "LA", flag: "🇱🇦", ddi: "856", label: "Laos", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "LS", flag: "🇱🇸", ddi: "266", label: "Lesoto", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "LV", flag: "🇱🇻", ddi: "371", label: "Letônia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "LB", flag: "🇱🇧", ddi: "961", label: "Líbano", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "LR", flag: "🇱🇷", ddi: "231", label: "Libéria", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "LY", flag: "🇱🇾", ddi: "218", label: "Líbia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "LI", flag: "🇱🇮", ddi: "423", label: "Liechtenstein", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "LT", flag: "🇱🇹", ddi: "370", label: "Lituânia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "LU", flag: "🇱🇺", ddi: "352", label: "Luxemburgo", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MO", flag: "🇲🇴", ddi: "853", label: "Macau", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MK", flag: "🇲🇰", ddi: "389", label: "Macedônia do Norte", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MG", flag: "🇲🇬", ddi: "261", label: "Madagascar", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MY", flag: "🇲🇾", ddi: "60", label: "Malásia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MW", flag: "🇲🇼", ddi: "265", label: "Malawi", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MV", flag: "🇲🇻", ddi: "960", label: "Maldivas", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "ML", flag: "🇲🇱", ddi: "223", label: "Mali", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MT", flag: "🇲🇹", ddi: "356", label: "Malta", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MA", flag: "🇲🇦", ddi: "212", label: "Marrocos", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MQ", flag: "🇲🇶", ddi: "596", label: "Martinica", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MU", flag: "🇲🇺", ddi: "230", label: "Maurício", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MR", flag: "🇲🇷", ddi: "222", label: "Mauritânia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "YT", flag: "🇾🇹", ddi: "262", label: "Mayotte", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MX", flag: "🇲🇽", ddi: "52", label: "México", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "FM", flag: "🇫🇲", ddi: "691", label: "Micronésia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MZ", flag: "🇲🇿", ddi: "258", label: "Moçambique", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MD", flag: "🇲🇩", ddi: "373", label: "Moldávia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MC", flag: "🇲🇨", ddi: "377", label: "Mônaco", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MN", flag: "🇲🇳", ddi: "976", label: "Mongólia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "ME", flag: "🇲🇪", ddi: "382", label: "Montenegro", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MS", flag: "🇲🇸", ddi: "1664", label: "Montserrat", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MM", flag: "🇲🇲", ddi: "95", label: "Myanmar", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "NA", flag: "🇳🇦", ddi: "264", label: "Namíbia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "NR", flag: "🇳🇷", ddi: "674", label: "Nauru", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "NP", flag: "🇳🇵", ddi: "977", label: "Nepal", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "NI", flag: "🇳🇮", ddi: "505", label: "Nicarágua", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "NE", flag: "🇳🇪", ddi: "227", label: "Níger", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "NG", flag: "🇳🇬", ddi: "234", label: "Nigéria", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "NU", flag: "🇳🇺", ddi: "683", label: "Niue", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "NO", flag: "🇳🇴", ddi: "47", label: "Noruega", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "NC", flag: "🇳🇨", ddi: "687", label: "Nova Caledônia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "NZ", flag: "🇳🇿", ddi: "64", label: "Nova Zelândia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "OM", flag: "🇴🇲", ddi: "968", label: "Omã", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "PW", flag: "🇵🇼", ddi: "680", label: "Palau", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "PS", flag: "🇵🇸", ddi: "970", label: "Palestina", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "PA", flag: "🇵🇦", ddi: "507", label: "Panamá", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "PG", flag: "🇵🇬", ddi: "675", label: "Papua-Nova Guiné", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "PK", flag: "🇵🇰", ddi: "92", label: "Paquistão", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "PY", flag: "🇵🇾", ddi: "595", label: "Paraguai", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "PE", flag: "🇵🇪", ddi: "51", label: "Peru", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "PF", flag: "🇵🇫", ddi: "689", label: "Polinésia Francesa", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "PL", flag: "🇵🇱", ddi: "48", label: "Polônia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "PR", flag: "🇵🇷", ddi: "1787", label: "Porto Rico", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "KE", flag: "🇰🇪", ddi: "254", label: "Quênia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "KG", flag: "🇰🇬", ddi: "996", label: "Quirguistão", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "KI", flag: "🇰🇮", ddi: "686", label: "Quiribati", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "GB", flag: "🇬🇧", ddi: "44", label: "Reino Unido", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CF", flag: "🇨🇫", ddi: "236", label: "República Centro-Africana", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "DO", flag: "🇩🇴", ddi: "1809", label: "República Dominicana", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CZ", flag: "🇨🇿", ddi: "420", label: "República Tcheca", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "RE", flag: "🇷🇪", ddi: "262", label: "Reunião", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "RO", flag: "🇷🇴", ddi: "40", label: "Romênia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "RW", flag: "🇷🇼", ddi: "250", label: "Ruanda", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "RU", flag: "🇷🇺", ddi: "7", label: "Rússia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "EH", flag: "🇪🇭", ddi: "212", label: "Saara Ocidental", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "WS", flag: "🇼🇸", ddi: "685", label: "Samoa", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "AS", flag: "🇦🇸", ddi: "1684", label: "Samoa Americana", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SM", flag: "🇸🇲", ddi: "378", label: "San Marino", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SH", flag: "🇸🇭", ddi: "290", label: "Santa Helena", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "LC", flag: "🇱🇨", ddi: "1758", label: "Santa Lúcia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "BL", flag: "🇧🇱", ddi: "590", label: "São Bartolomeu", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "KN", flag: "🇰🇳", ddi: "1869", label: "São Cristóvão e Nevis", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "MF", flag: "🇲🇫", ddi: "590", label: "São Martinho", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "PM", flag: "🇵🇲", ddi: "508", label: "São Pedro e Miquelão", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "ST", flag: "🇸🇹", ddi: "239", label: "São Tomé e Príncipe", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "VC", flag: "🇻🇨", ddi: "1784", label: "São Vicente e Granadinas", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SN", flag: "🇸🇳", ddi: "221", label: "Senegal", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SL", flag: "🇸🇱", ddi: "232", label: "Serra Leoa", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "RS", flag: "🇷🇸", ddi: "381", label: "Sérvia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SC", flag: "🇸🇨", ddi: "248", label: "Seychelles", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SG", flag: "🇸🇬", ddi: "65", label: "Singapura", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SX", flag: "🇸🇽", ddi: "1721", label: "Sint Maarten", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SY", flag: "🇸🇾", ddi: "963", label: "Síria", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SO", flag: "🇸🇴", ddi: "252", label: "Somália", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "LK", flag: "🇱🇰", ddi: "94", label: "Sri Lanka", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SZ", flag: "🇸🇿", ddi: "268", label: "Suazilândia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SD", flag: "🇸🇩", ddi: "249", label: "Sudão", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SS", flag: "🇸🇸", ddi: "211", label: "Sudão do Sul", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SE", flag: "🇸🇪", ddi: "46", label: "Suécia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "CH", flag: "🇨🇭", ddi: "41", label: "Suíça", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "SR", flag: "🇸🇷", ddi: "597", label: "Suriname", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "TJ", flag: "🇹🇯", ddi: "992", label: "Tadjiquistão", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "TH", flag: "🇹🇭", ddi: "66", label: "Tailândia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "TW", flag: "🇹🇼", ddi: "886", label: "Taiwan", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "TZ", flag: "🇹🇿", ddi: "255", label: "Tanzânia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "TL", flag: "🇹🇱", ddi: "670", label: "Timor-Leste", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "TG", flag: "🇹🇬", ddi: "228", label: "Togo", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "TK", flag: "🇹🇰", ddi: "690", label: "Tokelau", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "TO", flag: "🇹🇴", ddi: "676", label: "Tonga", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "TT", flag: "🇹🇹", ddi: "1868", label: "Trinidad e Tobago", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "TN", flag: "🇹🇳", ddi: "216", label: "Tunísia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "TM", flag: "🇹🇲", ddi: "993", label: "Turcomenistão", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "TR", flag: "🇹🇷", ddi: "90", label: "Turquia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "TV", flag: "🇹🇻", ddi: "688", label: "Tuvalu", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "UA", flag: "🇺🇦", ddi: "380", label: "Ucrânia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "UG", flag: "🇺🇬", ddi: "256", label: "Uganda", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "UY", flag: "🇺🇾", ddi: "598", label: "Uruguai", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "UZ", flag: "🇺🇿", ddi: "998", label: "Uzbequistão", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "VU", flag: "🇻🇺", ddi: "678", label: "Vanuatu", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "VA", flag: "🇻🇦", ddi: "379", label: "Vaticano", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "VE", flag: "🇻🇪", ddi: "58", label: "Venezuela", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "VN", flag: "🇻🇳", ddi: "84", label: "Vietnã", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "WF", flag: "🇼🇫", ddi: "681", label: "Wallis e Futuna", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "ZM", flag: "🇿🇲", ddi: "260", label: "Zâmbia", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
  { code: "ZW", flag: "🇿🇼", ddi: "263", label: "Zimbábue", maxDigits: 15, minDigits: 6, placeholder: GENERIC_PLACEHOLDER },
];

function formatPhoneBR(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatPhonePT(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function formatPhoneUS(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatPhone(value: string, country: Country) {
  if (country.code === "BR") return formatPhoneBR(value);
  if (country.code === "PT") return formatPhonePT(value);
  if (country.code === "US") return formatPhoneUS(value);
  // Demais países: apenas dígitos crus, limitado a 15 (E.164 nacional máximo).
  return value.replace(/\D/g, "").slice(0, 15);
}

function extractDigits(value: string) {
  return value.replace(/\D/g, "");
}

function buildWhatsappIdentifier(digits: string, ddi: string): string {
  if (ddi === "55") return digits;
  return ddi + digits;
}

export default function RevistaAcesso() {
  const navigate = useNavigate();
  const [checkingSession, setCheckingSession] = useState(true);
  const [step, setStep] = useState<"numero" | "codigo">("numero");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<Country>(COUNTRIES[0]);
  const [countryOpen, setCountryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [resendTimer, setResendTimer] = useState(0);
  const [otpMotivo, setOtpMotivo] = useState<"primeiro_acesso" | "prazo_expirado">("primeiro_acesso");
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const session = getValidRevistaSession();
    if (session) {
      navigate("/revista/leitura", { replace: true });
      return;
    }
    clearRevistaSession();
    setCheckingSession(false);
  }, [navigate]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!countryOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [countryOpen]);

  const cleanNumber = extractDigits(phone);
  const identifier = buildWhatsappIdentifier(cleanNumber, country.ddi);

  const isInputValid = cleanNumber.length >= country.minDigits && cleanNumber.length <= country.maxDigits;

  const handleSolicitarOtp = useCallback(async () => {
    if (!isInputValid) {
      setError("Por favor, verifique se o número está correto");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "revista-solicitar-otp",
        { body: { whatsapp: identifier } }
      );
      if (fnError) throw fnError;

      if (data?.status === "acesso_direto") {
        const newToken = persistRevistaToken(data.token);
        if (!newToken) { setError("Ocorreu um erro. Tente novamente."); return; }
        saveRevistaSession(newToken, data.licencas);
        const destino = data.versao_preferida === "leitor_cg" ? "/leitor/leitura" : "/revista/leitura";
        navigate(destino, { replace: true });
        return;
      }

      if (data?.status === "otp_enviado" || data?.sucesso) {
        setOtpMotivo(data?.motivo === "prazo_expirado" ? "prazo_expirado" : "primeiro_acesso");
        setStep("codigo");
        setResendTimer(60);
        setOtp(["", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }

      if (data?.erro === "numero_nao_encontrado") {
        setError("Número não encontrado. Verifique se usou o mesmo número informado na compra.");
        return;
      }
      if (data?.erro === "numero_invalido") {
        setError("Por favor, verifique se o número está correto");
        return;
      }
      if (data?.erro) {
        setError("Ocorreu um erro. Tente novamente.");
        return;
      }
    } catch {
      setError("Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [identifier, isInputValid, navigate]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 3) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleValidarOtp = async () => {
    const codigo = otp.join("");
    if (codigo.length !== 4) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "revista-validar-otp",
        { body: { whatsapp: identifier, codigo } }
      );
      if (fnError) throw fnError;
      if (data?.erro === "codigo_invalido") {
        setError("Código incorreto ou expirado. Verifique e tente novamente.");
        setOtp(["", "", "", ""]);
        otpRefs.current[0]?.focus();
        return;
      }
      if (data?.erro) { setError("Ocorreu um erro. Tente novamente."); return; }
      const newToken = persistRevistaToken(data.token);
      if (!newToken) { setError("Ocorreu um erro. Tente novamente."); return; }
      saveRevistaSession(newToken, data.licencas);
      const destino = data.versao_preferida === "leitor_cg" ? "/leitor/leitura" : "/revista/leitura";
      navigate(destino, { replace: true });
    } catch {
      setError("Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    if (resendTimer > 0) return;
    handleSolicitarOtp();
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <Card className="w-full max-w-[480px] shadow-lg border-0">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto w-20 h-20 flex items-center justify-center">
              <img src={logoCentralGospel} alt="Central Gospel Editora" className="w-20 h-20 object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              {step === "numero" ? "Acesse sua Revista Digital" : "Código enviado!"}
            </h1>
          </div>

          {step === "numero" && (
            <div className="space-y-5">
              <p className="text-lg text-muted-foreground text-center">
                Digite o número de WhatsApp que você usou na compra
              </p>
              <div className="flex gap-2 w-full">
                {/* Country selector */}
                <div className="relative shrink-0" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setCountryOpen((o) => !o)}
                    className="h-14 px-2 sm:px-3 flex items-center gap-1 sm:gap-1.5 rounded-lg border border-input bg-background hover:bg-accent transition-colors whitespace-nowrap"
                  >
                    <span className="text-lg sm:text-xl leading-none">{country.flag}</span>
                    <span className="text-xs sm:text-sm text-muted-foreground">+{country.ddi}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  {countryOpen && (
                    <div className="absolute top-full left-0 mt-1 w-56 bg-background border border-input rounded-lg shadow-lg z-50 py-1">
                      {COUNTRIES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setCountry(c);
                            setPhone("");
                            setError("");
                            setCountryOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors ${
                            c.code === country.code ? "bg-accent/50" : ""
                          }`}
                        >
                          <span className="text-xl leading-none">{c.flag}</span>
                          <span className="text-sm font-medium text-foreground">{c.label}</span>
                          <span className="text-sm text-muted-foreground ml-auto">+{c.ddi}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Phone input */}
                <input
                  type="tel"
                  placeholder={country.placeholder}
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value, country))}
                  maxLength={20}
                  className="flex-1 min-w-0 w-full h-14 text-base sm:text-xl text-center rounded-lg border border-input bg-background px-2 sm:px-3 outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
                />
              </div>
              {error && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-base text-amber-800">{error}</p>
                </div>
              )}
              <Button
                onClick={handleSolicitarOtp}
                disabled={loading || !isInputValid}
                className="w-full h-14 text-lg font-semibold"
              >
                {loading && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
                Acessar minha biblioteca
              </Button>
            </div>
          )}

          {step === "codigo" && (
            <div className="space-y-5">
              {otpMotivo === "prazo_expirado" && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-center">
                  <p className="text-base font-semibold text-amber-800">
                    Seu acesso expirou após 30 dias de inatividade.
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Digite o código enviado para o seu WhatsApp para renovar o acesso.
                  </p>
                </div>
              )}
              {otpMotivo === "primeiro_acesso" && (
                <p className="text-lg text-muted-foreground text-center">
                  Enviamos 4 números para o seu WhatsApp.
                  <br />
                  Abra o WhatsApp e digite o código aqui:
                </p>
              )}
              <div className="flex justify-center gap-3">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (otpRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-16 h-[72px] text-4xl text-center border-2 border-input rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
                  />
                ))}
              </div>
              {error && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-base text-amber-800">{error}</p>
                </div>
              )}
              <Button
                onClick={handleValidarOtp}
                disabled={loading || otp.join("").length !== 4}
                className="w-full h-14 text-lg font-semibold"
              >
                {loading && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
                Entrar
              </Button>
              <div className="text-center">
                <button
                  onClick={handleResend}
                  disabled={resendTimer > 0}
                  className="text-base text-muted-foreground hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed underline"
                >
                  {resendTimer > 0 ? `Reenviar em ${resendTimer}s` : "Não recebi o código"}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
