/** ROUND-ALL (Director 471, DIRECTOR DECISION, OVERRULABLE): the single words a person says for the Converter's measurement units, folded to the engine's unit symbol.
 * Only unambiguous words: m, t, d, s, b, h, g, l, c, f and in are left out on purpose (they are also ordinary words or mean two units), so those requests are asked about, never guessed. */
export const CONVERTER_UNIT_WORDS: Readonly<Record<string, string>> = Object.freeze({
  km: 'km', kilometer: 'km', kilometers: 'km', kilometre: 'km', kilometres: 'km',
  meter: 'm', meters: 'm', metre: 'm', metres: 'm', cm: 'cm', centimeter: 'cm', centimeters: 'cm', centimetre: 'cm', centimetres: 'cm', mm: 'mm', millimeter: 'mm', millimeters: 'mm', millimetre: 'mm', millimetres: 'mm',
  mile: 'mi', miles: 'mi', yard: 'yd', yards: 'yd', yd: 'yd', foot: 'ft', feet: 'ft', ft: 'ft', inch: 'in', inches: 'in',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg', gram: 'g', grams: 'g', mg: 'mg', milligram: 'mg', milligrams: 'mg', tonne: 't', tonnes: 't',
  pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb', ounce: 'oz', ounces: 'oz', oz: 'oz',
  celsius: '°C', centigrade: '°C', fahrenheit: '°F', kelvin: 'K',
  liter: 'L', liters: 'L', litre: 'L', litres: 'L', ml: 'mL', milliliter: 'mL', milliliters: 'mL', millilitre: 'mL', millilitres: 'mL', gallon: 'gal', gallons: 'gal', cup: 'cup', cups: 'cup',
  hectare: 'ha', hectares: 'ha', acre: 'ac', acres: 'ac',
  mph: 'mph', knot: 'kn', knots: 'kn',
  second: 's', seconds: 's', millisecond: 'ms', milliseconds: 'ms', minute: 'min', minutes: 'min', hour: 'h', hours: 'h', day: 'd', days: 'd', week: 'wk', weeks: 'wk',
  bit: 'bit', bits: 'bit', byte: 'B', bytes: 'B', kb: 'kB', kilobyte: 'kB', kilobytes: 'kB', mb: 'MB', megabyte: 'MB', megabytes: 'MB', gb: 'GB', gigabyte: 'GB', gigabytes: 'GB', tb: 'TB', terabyte: 'TB', terabytes: 'TB',
});
