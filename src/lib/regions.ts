/**
 * Administrative subdivisions (regions/departments) and major cities for supported countries.
 * This is a reference dataset for cascading country → region → city selection.
 * 
 * Sources: ISO 3166-2, national administrative divisions
 * Note: Only major cities are listed; full datasets would be much larger.
 */

export interface Region {
  code: string;
  name: string;
  cities: City[];
}

export interface City {
  name: string;
  /** Optional: slug for URL-friendly identifiers */
  slug?: string;
}

export interface CountryRegionData {
  countryCode: string;
  countryName: string;
  regions: Region[];
}

// Bénin - 12 departments
const BENIN_REGIONS: Region[] = [
  { code: 'AL', name: 'Alibori', cities: [{ name: 'Kandi' }, { name: 'Gogounou' }, { name: 'Ségbana' }] },
  { code: 'AK', name: 'Atakora', cities: [{ name: 'Natitingou' }, { name: 'Boukombé' }, { name: 'Kouandé' }, { name: 'Matéri' }, { name: 'Toucountouna' }] },
  { code: 'AQ', name: 'Atlantique', cities: [{ name: 'Allada' }, { name: 'Ouidah' }, { name: 'Toffo' }, { name: 'Tori-Bossito' }, { name: 'Zè' }] },
  { code: 'BO', name: 'Borgou', cities: [{ name: 'Parakou' }, { name: 'N\'Dali' }, { name: 'Bembèrèkè' }, { name: 'Kalalé' }, { name: 'Sinendé' }, { name: 'Tchaourou' }] },
  { code: 'CO', name: 'Collines', cities: [{ name: 'Savalou' }, { name: 'Bantè' }, { name: 'Dassa-Zoumè' }, { name: 'Glazoué' }, { name: 'Ouèssè' }] },
  { code: 'KO', name: 'Kouffo', cities: [{ name: 'Aplahoué' }, { name: 'Djakotomey' }, { name: 'Dogbo' }, { name: 'Klouékanmè' }, { name: 'Lalo' }, { name: 'Toviklin' }] },
  { code: 'DO', name: 'Donga', cities: [{ name: 'Djougou' }, { name: 'Bassila' }, { name: 'Copargo' }, { name: 'Ouaké' }] },
  { code: 'LI', name: 'Littoral', cities: [{ name: 'Cotonou' }] },
  { code: 'MO', name: 'Mono', cities: [{ name: 'Lokossa' }, { name: 'Athiémé' }, { name: 'Bopa' }, { name: 'Comè' }, { name: 'Grand-Popo' }, { name: 'Houèyogbé' }] },
  { code: 'OU', name: 'Ouémé', cities: [{ name: 'Porto-Novo' }, { name: 'Adjohoun' }, { name: 'Aguégués' }, { name: 'Akoïssè' }, { name: 'Avrankou' }, { name: 'Bonou' }, { name: 'Dangbo' }, { name: 'Sèmè-Podji' }] },
  { code: 'PL', name: 'Plateau', cities: [{ name: 'Pobè' }, { name: 'Adja-Ouèrè' }, { name: 'Ifangni' }, { name: 'Kétou' }, { name: 'Pobè' }] },
  { code: 'ZO', name: 'Zou', cities: [{ name: 'Abomey' }, { name: 'Agbangnizoun' }, { name: 'Bohicon' }, { name: 'Covè' }, { name: 'Djidja' }, { name: 'Ouinhi' }, { name: 'Zagnanado' }, { name: 'Zogbodomey' }] },
];

// Côte d'Ivoire - 31 regions + 2 autonomous districts
const IVOIRE_REGIONS: Region[] = [
  { code: 'AB', name: 'Aboisso', cities: [{ name: 'Aboisso' }, { name: 'Aby' }, { name: 'Assinie' }] },
  { code: 'AD', name: 'Adzopé', cities: [{ name: 'Adzopé' }, { name: 'Akoupé' }] },
  { code: 'AG', name: 'Agnibilékrou', cities: [{ name: 'Agnibilékrou' }] },
  { code: 'AK', name: 'Abidjan (District autonome)', cities: [{ name: 'Abidjan' }, { name: 'Cocody' }, { name: 'Plateau' }, { name: 'Yopougon' }, { name: 'Marcory' }, { name: 'Treichville' }, { name: 'Koumassi' }, { name: 'Port-Bouët' }, { name: 'Attécoubé' }, { name: 'Abobo' }, { name: 'Anyama' }, { name: 'Songon' }] },
  { code: 'AL', name: 'Alépé', cities: [{ name: 'Alépé' }] },
  { code: 'BD', name: 'Boundiali', cities: [{ name: 'Boundiali' }] },
  { code: 'BL', name: 'Bouaké', cities: [{ name: 'Bouaké' }, { name: 'Bouaké-SP' }, { name: 'Brobo' }] },
  { code: 'BN', name: 'Bongouanou', cities: [{ name: 'Bongouanou' }, { name: 'Dimbokro' }] },
  { code: 'BT', name: 'Bouna', cities: [{ name: 'Bouna' }] },
  { code: 'BY', name: 'Biankouma', cities: [{ name: 'Biankouma' }] },
  { code: 'CB', name: 'Bouaké (District autonome)', cities: [] },
  { code: 'CD', name: 'Daloa', cities: [{ name: 'Daloa' }, { name: 'Gagnoa' }, { name: 'Issia' }, { name: 'Vavoua' }] },
  { code: 'CE', name: 'Danane', cities: [{ name: 'Danane' }] },
  { code: 'CM', name: 'Divo', cities: [{ name: 'Divo' }, { name: 'Lakota' }] },
  { code: 'CN', name: 'Dabou', cities: [{ name: 'Dabou' }] },
  { code: 'CO', name: 'Coronel', cities: [{ name: 'Korhogo' }, { name: 'Ferkessédougou' }, { name: 'Sinématiali' }] },
  { code: 'CV', name: 'Yamoussoukro (District autonome)', cities: [{ name: 'Yamoussoukro' }, { name: 'Attiégouakro' }] },
  { code: 'DB', name: 'Dabakala', cities: [{ name: 'Dabakala' }] },
  { code: 'DD', name: 'Didiévi', cities: [{ name: 'Didiévi' }] },
  { code: 'DL', name: 'Daloa', cities: [{ name: 'Daloa' }] },
  { code: 'DN', name: 'Danané', cities: [{ name: 'Danané' }] },
  { code: 'EF', name: 'Ferkessédougou', cities: [{ name: 'Ferkessédougou' }] },
  { code: 'EN', name: 'Gagnoa', cities: [{ name: 'Gagnoa' }] },
  { code: 'FO', name: 'Grand-Lahou', cities: [{ name: 'Grand-Lahou' }] },
  { code: 'FR', name: 'Guiglo', cities: [{ name: 'Guiglo' }] },
  { code: 'GA', name: 'Grand-Bassam', cities: [{ name: 'Grand-Bassam' }] },
  { code: 'GU', name: 'Gbéléban', cities: [{ name: 'Gbéléban' }] },
  { code: 'GD', name: 'Issia', cities: [{ name: 'Issia' }] },
  { code: 'GR', name: 'Katiola', cities: [{ name: 'Katiola' }] },
  { code: 'GU', name: 'Korhogo', cities: [{ name: 'Korhogo' }, { name: 'Sinématiali' }] },
  { code: 'LB', name: 'Lakota', cities: [{ name: 'Lakota' }] },
  { code: 'LG', name: 'Man', cities: [{ name: 'Man' }, { name: 'Biankouma' }, { name: 'Bangolo' }, { name: 'Kouibly' }] },
  { code: 'ME', name: 'M\'Bahiakro', cities: [{ name: 'M\'Bahiakro' }] },
  { code: 'MO', name: 'Odienné', cities: [{ name: 'Odienné' }, { name: 'Minignan' }, { name: 'Samatiguila' }] },
  { code: 'NA', name: 'Séguéla', cities: [{ name: 'Séguéla' }, { name: 'Kani' }] },
  { code: 'NR', name: 'San-Pédro', cities: [{ name: 'San-Pédro' }, { name: 'Tabou' }] },
  { code: 'SA', name: 'Sakassou', cities: [{ name: 'Sakassou' }] },
  { code: 'SB', name: 'Sassandra', cities: [{ name: 'Sassandra' }] },
  { code: 'SG', name: 'Séguéla', cities: [{ name: 'Séguéla' }] },
  { code: 'SM', name: 'Soubré', cities: [{ name: 'Soubré' }, { name: 'Buyo' }, { name: 'Méagui' }] },
  { code: 'SP', name: 'Tabou', cities: [{ name: 'Tabou' }] },
  { code: 'SR', name: 'Tiassalé', cities: [{ name: 'Tiassalé' }] },
  { code: 'SS', name: 'Touba', cities: [{ name: 'Touba' }] },
  { code: 'TA', name: 'Toumodi', cities: [{ name: 'Toumodi' }] },
  { code: 'TC', name: 'Vavoua', cities: [{ name: 'Vavoua' }] },
  { code: 'TZ', name: 'Yamoussoukro', cities: [] },
  { code: 'VB', name: 'Zuénoula', cities: [{ name: 'Zuénoula' }] },
];

// Togo - 5 regions
const TOGO_REGIONS: Region[] = [
  { code: 'C', name: 'Centrale', cities: [{ name: 'Sokodé' }, { name: 'Tchamba' }, { name: 'Blitta' }] },
  { code: 'K', name: 'Kara', cities: [{ name: 'Kara' }, { name: 'Bassar' }, { name: 'Guérin-Kouka' }, { name: 'Niamtougou' }] },
  { code: 'M', name: 'Maritime', cities: [{ name: 'Lomé' }, { name: 'Aného' }, { name: 'Tsévié' }, { name: 'Vogan' }, { name: 'Tabligbo' }] },
  { code: 'P', name: 'Plateaux', cities: [{ name: 'Atakpamé' }, { name: 'Kpalimé' }, { name: 'Notse' }, { name: 'Badou' }] },
  { code: 'S', name: 'Savanes', cities: [{ name: 'Dapaong' }, { name: 'Mango' }, { name: 'Kanté' }] },
];

// Senegal - 14 regions
const SENEGAL_REGIONS: Region[] = [
  { code: 'DK', name: 'Dakar', cities: [{ name: 'Dakar' }, { name: 'Pikine' }, { name: 'Guédiawaye' }, { name: 'Rufisque' }] },
  { code: 'DB', name: 'Diourbel', cities: [{ name: 'Diourbel' }, { name: 'Mbacké' }, { name: 'Bambey' }] },
  { code: 'FK', name: 'Fatick', cities: [{ name: 'Fatick' }, { name: 'Foundiougne' }, { name: 'Gossas' }] },
  { code: 'KA', name: 'Kaffrine', cities: [{ name: 'Kaffrine' }, { name: 'Birkelane' }, { name: 'Koungheul' }] },
  { code: 'KD', name: 'Kédougou', cities: [{ name: 'Kédougou' }, { name: 'Salémata' }, { name: 'Saraya' }] },
  { code: 'KL', name: 'Kaolack', cities: [{ name: 'Kaolack' }, { name: 'Nioro du Rip' }, { name: 'Guinguinéo' }] },
  { code: 'KE', name: 'Kolda', cities: [{ name: 'Kolda' }, { name: 'Médina Yoro Foulah' }, { name: 'Vélingara' }] },
  { code: 'LG', name: 'Louga', cities: [{ name: 'Louga' }, { name: 'Kébémer' }, { name: 'Linguère' }] },
  { code: 'MT', name: 'Matam', cities: [{ name: 'Matam' }, { name: 'Kanel' }, { name: 'Ranérou' }] },
  { code: 'SL', name: 'Saint-Louis', cities: [{ name: 'Saint-Louis' }, { name: 'Dagana' }, { name: 'Podor' }] },
  { code: 'SE', name: 'Sédhiou', cities: [{ name: 'Sédhiou' }, { name: 'Bounkiling' }, { name: 'Goudomp' }] },
  { code: 'TC', name: 'Tambacounda', cities: [{ name: 'Tambacounda' }, { name: 'Koumpentoum' }, { name: 'Goudiry' }] },
  { code: 'TH', name: 'Thiès', cities: [{ name: 'Thiès' }, { name: 'Tivaouane' }, { name: 'Mbour' }] },
  { code: 'ZG', name: 'Ziguinchor', cities: [{ name: 'Ziguinchor' }, { name: 'Bignona' }, { name: 'Oussouye' }] },
];

// Ghana - 16 regions
const GHANA_REGIONS: Region[] = [
  { code: 'AA', name: 'Ahafo', cities: [{ name: 'Goaso' }, { name: 'Kenyasi' }, { name: 'Hwidiem' }] },
  { code: 'AH', name: 'Ashanti', cities: [{ name: 'Kumasi' }, { name: 'Obuasi' }, { name: 'Konongo' }, { name: 'Mampong' }, { name: 'Ejisu' }] },
  { code: 'BO', name: 'Bono', cities: [{ name: 'Sunyani' }, { name: 'Berekum' }, { name: 'Dormaa Ahenkro' }] },
  { code: 'BE', name: 'Bono East', cities: [{ name: 'Techiman' }, { name: 'Kintampo' }, { name: 'Atebubu' }] },
  { code: 'CE', name: 'Central', cities: [{ name: 'Cape Coast' }, { name: 'Winneba' }, { name: 'Swedru' }, { name: 'Elmina' }] },
  { code: 'EA', name: 'Eastern', cities: [{ name: 'Koforidua' }, { name: 'Nkawkaw' }, { name: 'Akwatia' }, { name: 'Suhum' }] },
  { code: 'GR', name: 'Greater Accra', cities: [{ name: 'Accra' }, { name: 'Tema' }, { name: 'Madina' }, { name: 'Ashaiman' }, { name: 'Dodowa' }] },
  { code: 'NE', name: 'North East', cities: [{ name: 'Nalerigu' }, { name: 'Bunkpurugu' }, { name: 'Gambaga' }] },
  { code: 'NO', name: 'Northern', cities: [{ name: 'Tamale' }, { name: 'Yendi' }, { name: 'Savelugu' }, { name: 'Tolon' }] },
  { code: 'OT', name: 'Oti', cities: [{ name: 'Dambai' }, { name: 'Krachi' }, { name: 'Nkwanta' }] },
  { code: 'SA', name: 'Savannah', cities: [{ name: 'Damongo' }, { name: 'Bole' }, { name: 'Salaga' }] },
  { code: 'UP', name: 'Upper East', cities: [{ name: 'Bolgatanga' }, { name: 'Bawku' }, { name: 'Navrongo' }] },
  { code: 'UW', name: 'Upper West', cities: [{ name: 'Wa' }, { name: 'Tumu' }, { name: 'Jirapa' }] },
  { code: 'VO', name: 'Volta', cities: [{ name: 'Ho' }, { name: 'Keta' }, { name: 'Hohoe' }, { name: 'Kpando' }] },
  { code: 'WE', name: 'Western', cities: [{ name: 'Sekondi-Takoradi' }, { name: 'Axim' }, { name: 'Tarkwa' }, { name: 'Bibiani' }] },
  { code: 'WN', name: 'Western North', cities: [{ name: 'Sefwi Wiawso' }, { name: 'Bibiani' }, { name: 'Enchi' }] },
];

// Nigeria - 36 states + FCT
const NIGERIA_REGIONS: Region[] = [
  { code: 'AB', name: 'Abia', cities: [{ name: 'Umuahia' }, { name: 'Aba' }, { name: 'Ohafia' }] },
  { code: 'AD', name: 'Adamawa', cities: [{ name: 'Yola' }, { name: 'Mubi' }, { name: 'Numan' }] },
  { code: 'AK', name: 'Akwa Ibom', cities: [{ name: 'Uyo' }, { name: 'Eket' }, { name: 'Ikot Ekpene' }] },
  { code: 'AN', name: 'Anambra', cities: [{ name: 'Awka' }, { name: 'Onitsha' }, { name: 'Nnewi' }, { name: 'Ekpeme' }] },
  { code: 'BA', name: 'Bauchi', cities: [{ name: 'Bauchi' }, { name: 'Misau' }, { name: 'Jama\'are' }] },
  { code: 'BE', name: 'Benue', cities: [{ name: 'Makurdi' }, { name: 'Gboko' }, { name: 'Otukpo' }] },
  { code: 'BO', name: 'Borno', cities: [{ name: 'Maiduguri' }, { name: 'Biu' }, { name: 'Bama' }] },
  { code: 'CR', name: 'Cross River', cities: [{ name: 'Calabar' }, { name: 'Ogoja' }, { name: 'Ikom' }] },
  { code: 'DE', name: 'Delta', cities: [{ name: 'Asaba' }, { name: 'Warri' }, { name: 'Sapele' }, { name: 'Ughelli' }] },
  { code: 'EB', name: 'Ebonyi', cities: [{ name: 'Abakaliki' }, { name: 'Afikpo' }] },
  { code: 'ED', name: 'Edo', cities: [{ name: 'Benin City' }, { name: 'Auchi' }, { name: 'Ekpoma' }] },
  { code: 'EK', name: 'Ekiti', cities: [{ name: 'Ado-Ekiti' }, { name: 'Ijero' }, { name: 'Ikere' }] },
  { code: 'EN', name: 'Enugu', cities: [{ name: 'Enugu' }, { name: 'Nsukka' }, { name: 'Oji River' }] },
  { code: 'FC', name: 'FCT Abuja', cities: [{ name: 'Abuja' }, { name: 'Gwagwalada' }, { name: 'Kuje' }] },
  { code: 'GO', name: 'Gombe', cities: [{ name: 'Gombe' }, { name: 'Kaltungo' }, { name: 'Bajoga' }] },
  { code: 'IM', name: 'Imo', cities: [{ name: 'Owerri' }, { name: 'Okigwe' }, { name: 'Orlu' }] },
  { code: 'JI', name: 'Jigawa', cities: [{ name: 'Dutse' }, { name: 'Hadejia' }, { name: 'Gumel' }] },
  { code: 'KD', name: 'Kaduna', cities: [{ name: 'Kaduna' }, { name: 'Zaria' }, { name: 'Kafanchan' }] },
  { code: 'KN', name: 'Kano', cities: [{ name: 'Kano' }, { name: 'Wudil' }, { name: 'Gaya' }, { name: 'Dawakin Kudu' }] },
  { code: 'KT', name: 'Katsina', cities: [{ name: 'Katsina' }, { name: 'Daura' }, { name: 'Funtua' }] },
  { code: 'KE', name: 'Kebbi', cities: [{ name: 'Birnin Kebbi' }, { name: 'Argungu' }, { name: 'Yauri' }] },
  { code: 'KO', name: 'Kogi', cities: [{ name: 'Lokoja' }, { name: 'Ajaokuta' }, { name: 'Idah' }] },
  { code: 'KW', name: 'Kwara', cities: [{ name: 'Ilorin' }, { name: 'Offa' }, { name: 'Omu-Aran' }] },
  { code: 'LA', name: 'Lagos', cities: [{ name: 'Lagos' }, { name: 'Ikeja' }, { name: 'Epe' }, { name: 'Badagry' }, { name: 'Ikorodu' }] },
  { code: 'NA', name: 'Nasarawa', cities: [{ name: 'Lafia' }, { name: 'Keffi' }, { name: 'Nasarawa' }] },
  { code: 'NI', name: 'Niger', cities: [{ name: 'Minna' }, { name: 'Bida' }, { name: 'Kontagora' }, { name: 'Suleja' }] },
  { code: 'OG', name: 'Ogun', cities: [{ name: 'Abeokuta' }, { name: 'Ijebu Ode' }, { name: 'Sagamu' }] },
  { code: 'ON', name: 'Ondo', cities: [{ name: 'Akure' }, { name: 'Ondo City' }, { name: 'Owo' }] },
  { code: 'OS', name: 'Osun', cities: [{ name: 'Osogbo' }, { name: 'Ile-Ife' }, { name: 'Ilesa' }] },
  { code: 'OY', name: 'Oyo', cities: [{ name: 'Ibadan' }, { name: 'Oyo Town' }, { name: 'Ogbomoso' }, { name: 'Saki' }] },
  { code: 'PL', name: 'Plateau', cities: [{ name: 'Jos' }, { name: 'Barkin Ladi' }, { name: 'Pankshin' }] },
  { code: 'RI', name: 'Rivers', cities: [{ name: 'Port Harcourt' }, { name: 'Ahoada' }, { name: 'Degema' }, { name: 'Bonny' }] },
  { code: 'SO', name: 'Sokoto', cities: [{ name: 'Sokoto' }, { name: 'Tambuwal' }, { name: 'Wurno' }] },
  { code: 'TA', name: 'Taraba', cities: [{ name: 'Jalingo' }, { name: 'Wukari' }, { name: 'Takum' }] },
  { code: 'YO', name: 'Yobe', cities: [{ name: 'Damaturu' }, { name: 'Potiskum' }, { name: 'Nguru' }] },
  { code: 'ZA', name: 'Zamfara', cities: [{ name: 'Gusau' }, { name: 'Kaura Namoda' }, { name: 'Talata Mafara' }] },
];

/** All country region data */
export const ALL_COUNTRY_REGIONS: CountryRegionData[] = [
  { countryCode: 'BJ', countryName: 'Bénin', regions: BENIN_REGIONS },
  { countryCode: 'CI', countryName: "Côte d'Ivoire", regions: IVOIRE_REGIONS },
  { countryCode: 'TG', countryName: 'Togo', regions: TOGO_REGIONS },
  { countryCode: 'SN', countryName: 'Sénégal', regions: SENEGAL_REGIONS },
  { countryCode: 'GH', countryName: 'Ghana', regions: GHANA_REGIONS },
  { countryCode: 'NG', countryName: 'Nigeria', regions: NIGERIA_REGIONS },
];

/** Get region data for a specific country */
export function getCountryRegions(countryCode: string): CountryRegionData | undefined {
  return ALL_COUNTRY_REGIONS.find((c) => c.countryCode === countryCode);
}

/** Get all regions for a country (flattened) */
export function getRegionsForCountry(countryCode: string): Region[] {
  return getCountryRegions(countryCode)?.regions || [];
}

/** Get all cities for a country (flattened) */
export function getCitiesForCountry(countryCode: string): City[] {
  const regions = getRegionsForCountry(countryCode);
  return regions.flatMap((r) => r.cities);
}

/** Get cities for a specific region */
export function getCitiesForRegion(countryCode: string, regionCode: string): City[] {
  const regions = getRegionsForCountry(countryCode);
  const region = regions.find((r) => r.code === regionCode);
  return region?.cities || [];
}