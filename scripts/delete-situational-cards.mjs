import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL="([^"]+)"/)[1];
const serviceKey = env.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/) ?.[1];
const anonKey = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY="([^"]+)"/)[1];

const supabase = createClient(url, serviceKey || anonKey);

// Situational full-sentence cards that are too specific to a scenario
// and whose expression is already covered by a standalone card
const toDelete = [
  'Did the transfer go through?',
  'Did you receive the money?',
  '5 PM sounds good',
  'Thank you for your patience and your trust',
  'Thank you for your patience and for trusting me',
  'I appreciate you trusting me',
  'I really appreciate your help',
  "I'd really appreciate it if you could help me",
  'What is this called?',
  'I feel very grateful for the life I have',
  'Is it okay if I say it like that?',
  'Is that how you say it?',
  "That's how you say it",
  "I'm not in a hurry",
  "I'm in no rush",
  "There's no rush",
  "Take your time, I'm not in a hurry",
  'She bought a beautiful jewel',
  'Just so I understand correctly, did you work there?',
  'Why did you leave?',
  "I'm in love with San Diego",
  'How did you discover it?',
  'Do you come here often?',
  'Tipping is part of the wage here',
  'I made a mistake',
  'Why is it so expensive?',
  'Can I give you a hug?',
  'This house is huge!',
  'Since I was a child',
  "I'm kidding / I'm just kidding",
  "Don't kid me",
  'I got my hair cut',
  'I got a bad haircut',
  'We gotta leave ASAP',
  "I'm doing good, man. How about you?",
  'The house belongs to all of us',
  'I come in clutch',
  'Did you get high?',
  'Are you ready yet?',
  'Did you call him yet?',
  "I haven't eaten yet",
  'I already ate',
  'As soon as I wake up',
  'Can you call me ASAP?',
  "I'm folding my clothes to put them away",
  'You should be proud of yourself',
  'I just need to speak more',
  'I went to the beach',
  'Where were you?',
  "There's a woman who's driving me crazy",
  'I returned it the next day',
  'You need to leave things running smoothly',
  'One day I\'ll have a Tesla',
  'On the beach I saw a lot of beautiful women',
];

let ok = 0, fail = 0;
for (const phrase of toDelete) {
  const { error } = await supabase.from('english_cards').delete().eq('phrase_en', phrase);
  if (error) { console.log('FAIL:', phrase, error.message); fail++; }
  else ok++;
}

console.log(`Deleted: ${ok} ok, ${fail} failed`);
