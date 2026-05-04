export interface PunJoke {
  setup: string;
  punchline: string;
}

export const punJokes: PunJoke[] = [
  { setup: "Why don't scientists trust atoms?", punchline: "Because they make up everything!" },
  { setup: "I'm reading a book about anti-gravity.", punchline: "It's impossible to put down!" },
  { setup: "What do you call a fake noodle?", punchline: "An impasta!" },
  { setup: "Why did the scarecrow win an award?", punchline: "He was outstanding in his field!" },
  { setup: "I used to hate facial hair...", punchline: "But then it grew on me." },
  { setup: "What do you call a bear with no teeth?", punchline: "A gummy bear!" },
  { setup: "Why don't eggs tell jokes?", punchline: "They'd crack each other up!" },
  { setup: "I told my wife she was drawing her eyebrows too high.", punchline: "She looked surprised." },
  { setup: "What do you call a dog that does magic?", punchline: "A Labracadabrador!" },
  { setup: "Why did the bicycle fall over?", punchline: "Because it was two-tired!" },
  { setup: "What do you call a fish without eyes?", punchline: "A fsh!" },
  { setup: "I'm on a seafood diet.", punchline: "I see food and I eat it." },
  { setup: "Why can't you give Elsa a balloon?", punchline: "Because she will let it go!" },
  { setup: "What did the ocean say to the beach?", punchline: "Nothing, it just waved." },
  { setup: "Why do cows have hooves instead of feet?", punchline: "Because they lactose!" },
  { setup: "I told a chemistry joke once.", punchline: "There was no reaction." },
  { setup: "What do you call a sleeping dinosaur?", punchline: "A dino-snore!" },
  { setup: "Why did the math book look so sad?", punchline: "Because it had too many problems." },
  { setup: "What do you call a can opener that doesn't work?", punchline: "A can't opener!" },
  { setup: "I used to be a banker...", punchline: "But I lost interest." },
  { setup: "What do you call a lazy kangaroo?", punchline: "A pouch potato!" },
  { setup: "Why don't skeletons fight each other?", punchline: "They don't have the guts!" },
  { setup: "I asked the librarian if the library had books on paranoia.", punchline: "She whispered, 'They're right behind you!'" },
  { setup: "What do you call a snowman with a six-pack?", punchline: "An abdominal snowman!" },
  { setup: "Why did the golfer bring two pairs of pants?", punchline: "In case he got a hole in one!" },
  { setup: "What do you call a belt made of watches?", punchline: "A waist of time!" },
  { setup: "I couldn't figure out how to put my seatbelt on.", punchline: "Then it clicked." },
  { setup: "What do you call a dinosaur that crashes his car?", punchline: "Tyrannosaurus Wrecks!" },
  { setup: "Why did the coffee file a police report?", punchline: "It got mugged!" },
  { setup: "What do you call a pig that does karate?", punchline: "A pork chop!" },
  { setup: "I'm so good at sleeping...", punchline: "I can do it with my eyes closed." },
  { setup: "What do you call a cow with no legs?", punchline: "Ground beef!" },
  { setup: "Why don't oysters share their pearls?", punchline: "Because they're shellfish!" },
  { setup: "I told my computer I needed a break.", punchline: "Now it won't stop sending me Kit-Kat ads." },
  { setup: "What do you call a deer with no eyes?", punchline: "No idea!" },
  { setup: "Why did the stadium get hot after the game?", punchline: "All the fans left!" },
  { setup: "What do you call a train carrying bubble gum?", punchline: "A chew-chew train!" },
  { setup: "I used to play piano by ear...", punchline: "Now I use my hands." },
  { setup: "What do you call a boomerang that won't come back?", punchline: "A stick!" },
  { setup: "Why did the tomato turn red?", punchline: "Because it saw the salad dressing!" },
  { setup: "What do you call a fake stone in Ireland?", punchline: "A sham rock!" },
  { setup: "I'm afraid for the calendar.", punchline: "Its days are numbered." },
  { setup: "What do you call a cow with two legs?", punchline: "Lean beef!" },
  { setup: "Why did the invisible man turn down the job offer?", punchline: "He couldn't see himself doing it." },
  { setup: "What do you call a dog magician?", punchline: "A Labracadabrador!" },
  { setup: "I couldn't sleep last night...", punchline: "Because I kept waking up." },
  { setup: "What do you call a fish wearing a bowtie?", punchline: "Sofishticated!" },
  { setup: "Why did the banana go to the doctor?", punchline: "Because it wasn't peeling well!" },
  { setup: "What do you call a pile of cats?", punchline: "A meow-ntain!" },
  { setup: "I only know 25 letters of the alphabet.", punchline: "I don't know y." },
  { setup: "What do you call a witch at the beach?", punchline: "A sand-witch!" },
  { setup: "Why did the man put his money in the freezer?", punchline: "He wanted cold hard cash!" },
  { setup: "What do you call a dinosaur that waits its turn?", punchline: "Patientosaurus!" },
  { setup: "I got fired from the calendar factory.", punchline: "All I did was take a day off!" },
  { setup: "What do you call a vampire with no teeth?", punchline: "A gumdrop!" },
  { setup: "Why did the gym close down?", punchline: "It just didn't work out!" },
  { setup: "What do you call a snowman in July?", punchline: "A puddle!" },
  { setup: "I'm writing a book on reverse psychology.", punchline: "Please don't buy it." },
  { setup: "What do you call a rabbit with no ears?", punchline: "A rounder!" },
  { setup: "Why did the chicken go to the séance?", punchline: "To get to the other side!" },
  { setup: "What do you call a monkey in a minefield?", punchline: "A baboom!" },
];

export async function fetchApiJoke(): Promise<PunJoke | null> {
  try {
    const resp = await fetch(
      'https://v2.jokeapi.dev/joke/Pun?lang=en&blacklistFlags=nsfw,religious,political,racist,sexist'
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data.error) return null;
    if (data.type === 'single') {
      return { setup: '', punchline: data.joke };
    }
    return { setup: data.setup, punchline: data.delivery };
  } catch {
    return null;
  }
}
