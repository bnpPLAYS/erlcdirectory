/**
 * Coarse profile regions — avoids exact addresses. Grouped for the editor picker.
 * Legacy UK/Ireland list matches the original `ukCounties.ts` COUNTY_OPTIONS sort (`en-GB`).
 */

const US_STATES: string[] = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'District of Columbia',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
];

const MEXICO_STATES: string[] = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'México',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
];

/** Exact legacy RAW array from original `ukCounties.ts` (before global sort). */
const UK_IRELAND_LEGACY_RAW: string[] = [
  'Outside UK & Ireland',
  'Republic of Ireland',
  'Bedfordshire',
  'Berkshire',
  'Bristol',
  'Buckinghamshire',
  'Cambridgeshire',
  'Cheshire',
  'Cornwall',
  'Cumbria',
  'Derbyshire',
  'Devon',
  'Dorset',
  'Durham',
  'East Riding of Yorkshire',
  'East Sussex',
  'Essex',
  'Gloucestershire',
  'Greater London',
  'Greater Manchester',
  'Hampshire',
  'Herefordshire',
  'Hertfordshire',
  'Isle of Wight',
  'Kent',
  'Lancashire',
  'Leicestershire',
  'Lincolnshire',
  'Merseyside',
  'Norfolk',
  'North Yorkshire',
  'Northamptonshire',
  'Northumberland',
  'Nottinghamshire',
  'Oxfordshire',
  'Rutland',
  'Shropshire',
  'Somerset',
  'South Yorkshire',
  'Staffordshire',
  'Suffolk',
  'Surrey',
  'Tyne and Wear',
  'Warwickshire',
  'West Midlands',
  'West Sussex',
  'West Yorkshire',
  'Wiltshire',
  'Worcestershire',
  'Anglesey',
  'Blaenau Gwent',
  'Bridgend',
  'Caerphilly',
  'Cardiff',
  'Carmarthenshire',
  'Ceredigion',
  'Conwy',
  'Denbighshire',
  'Flintshire',
  'Gwynedd',
  'Merthyr Tydfil',
  'Monmouthshire',
  'Neath Port Talbot',
  'Newport',
  'Pembrokeshire',
  'Powys',
  'Rhondda Cynon Taf',
  'Swansea',
  'Torfaen',
  'Vale of Glamorgan',
  'Wrexham',
  'Aberdeen City',
  'Aberdeenshire',
  'Angus',
  'Argyll and Bute',
  'Clackmannanshire',
  'Dumfries and Galloway',
  'Dundee City',
  'East Ayrshire',
  'East Dunbartonshire',
  'East Lothian',
  'East Renfrewshire',
  'Edinburgh',
  'Falkirk',
  'Fife',
  'Glasgow City',
  'Highland',
  'Inverclyde',
  'Midlothian',
  'Moray',
  'Na h-Eileanan Siar',
  'North Ayrshire',
  'North Lanarkshire',
  'Orkney Islands',
  'Perth and Kinross',
  'Renfrewshire',
  'Scottish Borders',
  'Shetland Islands',
  'South Ayrshire',
  'South Lanarkshire',
  'Stirling',
  'West Dunbartonshire',
  'West Lothian',
  'Antrim and Newtownabbey',
  'Armagh City, Banbridge and Craigavon',
  'Belfast',
  'Causeway Coast and Glens',
  'Derry and Strabane',
  'Fermanagh and Omagh',
  'Lisburn and Castlereagh',
  'Mid and East Antrim',
  'Mid Ulster',
  'Newry, Mourne and Down',
  'Ards and North Down',
];

/** Same ordering as legacy `COUNTY_OPTIONS`: dedupe + `en-GB` sort of all UK/Ireland entries. */
const UK_IRELAND_LEGACY_SORTED: readonly string[] = Object.freeze(
  [...new Set(UK_IRELAND_LEGACY_RAW)].sort((a, b) => a.localeCompare(b, 'en-GB')),
);

export type ProfileLocationGroup = {
  readonly label: string;
  readonly options: readonly string[];
};

function prefix(prefix: string, names: readonly string[]): string[] {
  return names.map((n) => `${prefix}${n}`);
}

/** Whole-country picks only (no states/provinces). */
const COUNTRY_ONLY: readonly string[] = ['Australia', 'Canada'];

/** Grouped options for the profile editor `<Select />`. */
export const PROFILE_LOCATION_GROUPS: readonly ProfileLocationGroup[] = [
  {
    label: 'United Kingdom & Ireland',
    options: UK_IRELAND_LEGACY_SORTED,
  },
  {
    label: 'United States',
    options: prefix('United States — ', US_STATES),
  },
  {
    label: 'Mexico',
    options: prefix('Mexico — ', MEXICO_STATES),
  },
  {
    label: 'Countries',
    options: COUNTRY_ONLY,
  },
];

/** Flat list for validation — every allowed stored value. */
export const PROFILE_LOCATION_OPTIONS: readonly string[] = Object.freeze(
  [...new Set(PROFILE_LOCATION_GROUPS.flatMap((g) => [...g.options]))].sort((a, b) =>
    a.localeCompare(b, 'en'),
  ),
);

/** @deprecated Use PROFILE_LOCATION_OPTIONS */
export const COUNTY_OPTIONS = PROFILE_LOCATION_OPTIONS;

export function normalizeStoredCounty(raw: string | null | undefined): string {
  const t = raw?.trim();
  if (!t) return '';
  return PROFILE_LOCATION_OPTIONS.includes(t) ? t : '';
}
