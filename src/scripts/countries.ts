// ISO 3166-1 alpha-2 codes used by the Radio Browser API, with display names.
// Popular markets first, then the rest alphabetically. The empty-code entry
// (handled in the UI) means "top stations worldwide".

export interface CountryOption {
  code: string;
  name: string;
}

export const COUNTRIES: CountryOption[] = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'IE', name: 'Ireland' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'FI', name: 'Finland' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MT', name: 'Malta' },
  { code: 'NO', name: 'Norway' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'JP', name: 'Japan' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'IN', name: 'India' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'TR', name: 'Turkey' },
];

/** Every country/territory offered in the picker (and clickable on the globe). */
export const ALL_COUNTRY_CODES: string[] = (
  'AD AE AF AG AI AL AM AO AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BW BY BZ '
  + 'CA CD CF CG CH CI CK CL CM CN CO CR CU CV CW CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR '
  + 'GA GB GD GE GF GG GH GL GM GN GP GQ GR GS GT GU GW GY HK HN HR HT HU ID IE IL IM IN IQ IR IS IT JE JM JO JP '
  + 'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ '
  + 'MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY '
  + 'QA RE RO RS RU RW SA SB SC SD SE SG SH SI SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TG TH TJ TL TM TN TO TR '
  + 'TT TW TZ UA UG US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'
).split(' ');

const curatedNames = new Map(COUNTRIES.map((c) => [c.code, c.name]));
let displayNames: Intl.DisplayNames | null | undefined;

/** English display name for an ISO alpha-2 code (falls back to the code itself). */
export function countryName(code: string | null | undefined): string {
  const cc = (code || '').toUpperCase();
  if (!cc) return '';
  const curated = curatedNames.get(cc);
  if (curated) return curated;
  if (displayNames === undefined) {
    try { displayNames = new Intl.DisplayNames(['en'], { type: 'region' }); } catch { displayNames = null; }
  }
  try { return displayNames?.of(cc) || cc; } catch { return cc; }
}

const NEEDS_THE = /^(United |Netherlands|Philippines|Czech Republic|Dominican Republic|Bahamas|Gambia|Maldives|Central African|Democratic Republic|Republic of|Cayman|Falkland|Faroe|Marshall|Solomon|Virgin|Turks|Comoros|Seychelles|Vatican)/;

/** "the United Kingdom", "the Netherlands", but "France" — for use mid-sentence. */
export function inCountry(name: string): string {
  return NEEDS_THE.test(name) ? `the ${name}` : name;
}
