/** Director 471 (ROUND-ALL): real-brain proof for the Date Calculator through the date SHAPER (src/brain/mind/bind/shapers.ts).
 * Every answer below is worked out by hand from the real calendar (2024 is a leap year; 2024-01-01 is a Monday). Not matched by the resolver, so reported as gaps: "N days after DATE", "DATE plus N years", "N days before DATE". */
import { runLiveProof, type ProofReply } from './helpers/liveProof';
const has = (text: string) => (reply: ProofReply): string | null => (reply.content.includes(text) ? null : `expected "${text}" in ${reply.content.slice(0, 140)}`);
const days = (a: string, b: string, n: string): readonly [string, (x: ProofReply) => string | null] => [`how many days between ${a} and ${b}`, has(`The difference is ${n} days`)];
const wd = (d: string, name: string, text: string): readonly [string, (x: ProofReply) => string | null] => [`what day of the week is ${d}`, has(`${text} is a ${name}.`)];
const doy = (d: string, n: string, text: string): readonly [string, (x: ProofReply) => string | null] => [`what is the day of the year for ${d}`, has(`${text} is day ${n} of the year.`)];
const iso = (d: string, n: string, text: string): readonly [string, (x: ProofReply) => string | null] => [`what iso week is ${d}`, has(`${text} is in ISO week ${n}.`)];
const add = (message: string, text: string): readonly [string, (x: ProofReply) => string | null] => [message, has(`The date is ${text}.`)];
await runLiveProof({
  name: 'liveBrainDateCalculator', toolId: 'date-calculator',
  answers: [
    days('2024-01-01', '2024-03-01', '60'), days('2024-01-01', '2024-02-01', '31'), days('2023-01-01', '2024-01-01', '365'), days('2024-01-01', '2025-01-01', '366'),
    ['date difference 2024-01-01 2024-02-01', has('The difference is 31 days')], ['what is the difference between 2024-03-01 and 2024-01-01', has('The difference is 60 days')],
    wd('2024-01-01', 'Monday', 'January 1, 2024'), wd('2000-01-01', 'Saturday', 'January 1, 2000'), wd('2024-07-04', 'Thursday', 'July 4, 2024'), wd('2023-12-25', 'Monday', 'December 25, 2023'), wd('2024-02-29', 'Thursday', 'February 29, 2024'),
    doy('2024-03-01', '61', 'March 1, 2024'), doy('2023-03-01', '60', 'March 1, 2023'), doy('2024-12-31', '366', 'December 31, 2024'), doy('2023-12-31', '365', 'December 31, 2023'), doy('2024-01-01', '1', 'January 1, 2024'),
    iso('2024-03-01', '9', 'March 1, 2024'), iso('2024-01-01', '1', 'January 1, 2024'), iso('2021-01-01', '53', 'January 1, 2021'), iso('2024-12-30', '1', 'December 30, 2024'),
    add('add 10 days to 2024-01-01', 'January 11, 2024'), add('add 2 months to 2024-01-31', 'March 31, 2024'), add('subtract 2 months from 2024-03-31', 'January 31, 2024'), add('add 1 year to 2024-01-01', 'January 1, 2025'),
    add('add 2 days to 2024-12-30', 'January 1, 2025'), add('subtract 1 day from 2024-03-01', 'February 29, 2024'), add('add 21 days to 2024-01-01', 'January 22, 2024'),
    ['how many weekdays between 2024-01-01 and 2024-01-31', has('There are 23 weekdays')], ['how many weekdays between 2024-01-01 and 2024-01-07', has('There are 5 weekdays')], ['how many weekdays between 2024-01-01 and 2024-01-05', has('There are 5 weekdays')],
  ],
  mustNot: [
    'how do I calculate days between 2024-01-01 and 2024-03-01', 'what is the date today', 'how many days until 2024-12-25', 'days between 2024-01-01 and 2024-03-01 in python', 'add 10 days to my birthday',
    'remind me 10 days after 2024-01-01', 'add 10 days to 2024-01-01 and 5 days to 2024-02-01', 'what day of the week is today', 'what day is 2024-01-01 at 5pm', 'how old is someone born 2000-01-01',
    'how many days between 2024-01-01', 'what is the difference between 2024-01-01 and 2024-02-01 and 2024-03-01', 'add 10 to 2024-01-01', 'add 10 days', 'do not add 10 days to 2024-01-01',
    'what weekday is 2024-13-45', 'what day of the week is it', 'iso week and weekday of 2024-03-01', 'weekday of 2024-03-01 and day of the year', 'add 1.5 days to 2024-01-01',
    'subtract -5 days from 2024-01-01', 'is 2024 a leap year', 'schedule a meeting 10 days after 2024-01-01', 'what is the weather on 2024-01-01', 'translate 2024-01-01 to Spanish',
    'send 2024-01-01 to Anna', 'how many hours between 2024-01-01 and 2024-01-02', 'sort the days of the week', 'add 10 days to 2024-01-01 using excel', 'what weekday is 01/02/2024',
    'how does the iso week work for 2024-03-01', 'when is the deadline 10 days after 2024-01-01', 'what day of the week is 2024-01-01 ' + 'a '.repeat(300),
  ],
  others: ['hello', 'thank you', 'what can you do', 'tell me a joke', 'spell the number 42', 'sort the lines "b\na"', 'count words in "one two three"', 'create QR code containing "hello"', 'what is 15% of 80', 'calculate "2+2"'],
});
