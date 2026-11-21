/** Director 471 (ROUND-ALL): real-brain proof for the Converter, UNIT conversion only, through the converter SHAPER (src/brain/mind/bind/shapers.ts).
 * Answers are worked out by hand (1 mile = 1.609344 km, 1 kg = 2.20462 lb, 1 inch = 2.54 cm, C = (F - 32) x 5/9). Data, text and image conversions are not answered by the lane (the guard yields).
 * Not matched by the resolver, so reported as gaps: no convert verb ("100 fahrenheit in celsius"), time units ("convert 2 hours to minutes", the Timer row also claims them), km/h (split into two words), decimal numbers (the sentence splitter). */
import { runLiveProof, type ProofReply } from './helpers/liveProof';
const has = (text: string) => (reply: ProofReply): string | null => (reply.content.includes(text) ? null : `expected "${text}" in ${reply.content.slice(0, 140)}`);
const conv = (message: string, result: string): readonly [string, (x: ProofReply) => string | null] => [message, has(`The converted result is ${result}`)];
await runLiveProof({
  name: 'liveBrainConverter', toolId: 'converter',
  answers: [
    conv('convert 5 km to miles', '3.1068'), conv('convert 12 inches to cm', '30.48. '), conv('convert 70 kg to pounds', '154.32'), conv('how many pounds is 70 kg', '154.32'), conv('convert 1 gigabyte to megabytes', '1000. '),
    conv('convert 100 fahrenheit to celsius', '37.77'), conv('convert 0 celsius to fahrenheit', '32. '), conv('convert 100 celsius to fahrenheit', '212. '), conv('convert 32 fahrenheit to celsius', '0. '), conv('convert 0 celsius to kelvin', '273.15. '),
    conv('convert 1 mile to km', '1.6093'), conv('convert 1 foot to inches', '12. '), conv('convert 1 kilogram to grams', '1000. '), conv('convert 1 gallon to liters', '3.7854'), conv('convert 1 acre to hectares', '0.4046'),
    conv('convert 3 feet to yards', '1. '), conv('convert 1 tonne to kg', '1000. '), conv('convert 16 ounces to pounds', '1. '), conv('convert 1 km to meters', '1000. '), conv('convert 1 megabyte to kilobytes', '1000. '),
    conv('convert 1 liter to milliliters', '1000. '), conv('how many feet is 1 mile', '5280. '), conv('how many ounces is 1 pound', '16. '), conv('convert 10 cm to mm', '100. '),
  ],
  mustNot: [
    'how do I convert 5 km to miles', 'convert 5 km to miles in python', 'convert 5 dollars to euros', 'convert 5 km', 'convert km to miles', 'convert 5 km to kg', 'convert this csv to json', 'convert my image to png',
    'convert 5 km to miles and 10 kg to pounds', 'convert 5 km to 10 miles', 'what is a kilometer', 'convert 255 to hex', 'convert 5 apples to oranges', 'do not convert 5 km to miles', 'convert my weight 70 kg to pounds',
    'how many miles is the moon', 'convert 5 km to miles using excel', 'convert 5 m to ft', 'convert 5 in to cm', 'convert 5 km to km', 'why is a mile longer than a km', 'convert 5 km to miles approximately',
    'is 5 km more than 3 miles', 'convert 5 miles to kilometers for my recipe', 'convert 5 km to miles?? tell me more', 'convert "5 km" to miles', 'convert 5 gigabytes to a file', 'convert 5 km to miles ' + 'a '.repeat(80),
  ],
  others: ['hello', 'thank you', 'what can you do', 'tell me a joke', 'spell the number 42', 'sort the lines "b\na"', 'count words in "one two three"', 'create QR code containing "hello"', 'what is 15% of 80', 'calculate "2+2"', 'how many days between 2024-01-01 and 2024-03-01'],
});
