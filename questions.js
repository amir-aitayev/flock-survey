// The survey, in English and Italian. Answers are stored under each question's
// `id` as stable option codes (`v`), never as display text, so results can be
// counted the same way whatever language someone answered in.
//
// Five core questions (about a minute) carry the validation. The `bonus`
// questions are offered on the thank-you screen, and every one can be skipped.
//
// Types: single (one option, advances on tap), multi (several, `exclusive`
// clears the rest), scale (1–5), text, combo (two short singles on one
// screen), prices (three € fields), contact (last core screen, sends).
// `when(answers)` hides a question; `follow` reveals a text field for one option.

export const PARTS = {
  you: { en: 'About you', it: 'Su di te' },
  life: { en: 'Flat life', it: 'La vita in casa' },
  pay: { en: 'Would you pay?', it: 'Pagheresti?' },
  bonus: { en: 'Bonus round', it: 'Round bonus' },
};

const YES = { v: 'yes', en: 'Yes', it: 'Sì' };
const NO = { v: 'no', en: 'No', it: 'No' };

export const QUESTIONS = [
  // Core 1 · screener: anyone not living with flatmates finishes here
  {
    id: 'you', part: 'you', type: 'combo',
    title: { en: 'Which city do you live in?', it: 'In che città vivi?' },
    parts: [
      {
        id: 'city',
        options: [
          { v: 'rome', en: 'Rome', it: 'Roma' },
          { v: 'milan', en: 'Milan', it: 'Milano' },
          { v: 'other', en: 'Elsewhere', it: 'Altrove' },
        ],
      },
      {
        id: 'living', layout: 'list',
        title: { en: 'Who do you live with?', it: 'Con chi vivi?' },
        options: [
          { v: 'flatmates', en: 'Flatmates (I rent a room)', it: 'Coinquilini (affitto una stanza)', icon: 'users', tone: 'chat' },
          { v: 'partner_family', en: 'Partner or family', it: 'Partner o famiglia', icon: 'heart', tone: 'money' },
          { v: 'alone', en: 'Alone', it: 'Da solo/a', icon: 'user', tone: 'quiet' },
          { v: 'residence', en: 'Student residence', it: 'Residenza universitaria', icon: 'home', tone: 'laundry' },
        ],
      },
    ],
  },
  // Core 2 · the pain
  {
    id: 'tensions', part: 'life', type: 'multi', layout: 'tiles',
    title: { en: 'In the last 30 days, what caused tension in your flat?', it: 'Negli ultimi 30 giorni, cosa ha creato tensione in casa?' },
    hint: { en: 'Pick all that apply.', it: 'Scegli tutte quelle che valgono.' },
    options: [
      { v: 'cleaning', en: 'Cleaning turns', it: 'Turni di pulizia', icon: 'sparkle', tone: 'cleaning' },
      { v: 'trash', en: 'Taking out the trash', it: 'Buttare la spazzatura', icon: 'trash', tone: 'cleaning' },
      { v: 'laundry', en: 'Washing machine or dryer', it: 'Lavatrice o asciugatrice', icon: 'wash', tone: 'laundry' },
      { v: 'bills', en: 'Splitting bills', it: 'Dividere le bollette', icon: 'bill', tone: 'money' },
      { v: 'energy', en: 'Energy or heating use', it: 'Consumi di luce o riscaldamento', icon: 'bolt', tone: 'money' },
      { v: 'groceries', en: 'Shared groceries or supplies', it: 'Spesa e scorte comuni', icon: 'cart', tone: 'money' },
      { v: 'noise', en: 'Noise or guests', it: 'Rumore o ospiti', icon: 'moon', tone: 'quiet' },
      { v: 'language', en: 'Language or misunderstandings', it: 'Lingua o malintesi', icon: 'chat', tone: 'chat' },
      { v: 'nothing', en: 'Nothing, all good', it: 'Niente, tutto bene', icon: 'check', tone: 'neutral', exclusive: true },
    ],
  },
  // Core 3 · how big the pain is
  {
    id: 'difficulty', part: 'life', type: 'scale',
    title: { en: 'How hard is it to keep your flat organised today?', it: 'Quanto è difficile tenere la casa organizzata oggi?' },
    low: { en: 'Easy', it: 'Facile' },
    high: { en: 'Very hard', it: 'Molto difficile' },
  },
  // Core 4 · willingness to pay, with the idea shown above it
  {
    id: 'pay_1799', part: 'pay', type: 'single', concept: true,
    title: {
      en: 'At €3 a year per person, or €17.99 for the whole flat, would your flat pay?',
      it: "A 3 € all'anno a persona, o 17,99 € per tutta la casa, la tua casa pagherebbe?",
    },
    options: [
      { v: 'yes', en: 'Yes', it: 'Sì' },
      { v: 'probably', en: 'Probably', it: 'Probabilmente' },
      { v: 'landlord', en: 'Only if the landlord pays', it: 'Solo se paga il proprietario' },
      { v: 'no', en: 'No', it: 'No' },
    ],
  },
  // Core 5 · commitment, the only answer that counts as proof
  {
    id: 'contact', part: 'pay', type: 'contact', optional: true,
    title: { en: 'Want to try it free in your flat before anyone else?', it: 'Vuoi provarla gratis in casa tua prima di tutti?' },
    hint: {
      en: "Leave your Instagram, WhatsApp or email. It's optional, and it's the only answer that isn't anonymous.",
      it: "Lascia Instagram, WhatsApp o email. È facoltativo, ed è l'unica risposta non anonima.",
    },
    placeholder: { en: '@yourname, +39… or email', it: '@tuonome, +39… o email' },
  },

  // Bonus
  {
    id: 'landlord', part: 'bonus', type: 'single', bonus: true,
    title: { en: 'Who rents you the room?', it: 'Chi ti affitta la stanza?' },
    options: [
      { v: 'joivy', en: 'Joivy / DoveVivo', it: 'Joivy / DoveVivo' },
      { v: 'other_coliving', en: 'Another coliving company', it: "Un'altra società di coliving" },
      { v: 'private', en: 'A private landlord', it: 'Un proprietario privato' },
      { v: 'agency', en: 'An agency', it: "Un'agenzia" },
      { v: 'not_sure', en: 'Not sure', it: 'Non lo so' },
    ],
  },
  {
    id: 'flat_size', part: 'bonus', type: 'single', layout: 'row', bonus: true,
    title: { en: 'How many people live in your flat, including you?', it: 'Quante persone vivono nel tuo appartamento, te compreso/a?' },
    options: [
      { v: '2', en: '2', it: '2' },
      { v: '3', en: '3', it: '3' },
      { v: '4', en: '4', it: '4' },
      { v: '5', en: '5', it: '5' },
      { v: '6plus', en: '6+', it: '6+' },
    ],
  },
  {
    id: 'tools', part: 'bonus', type: 'multi', layout: 'tiles', bonus: true,
    title: { en: 'What does your flat use to organise itself today?', it: 'Cosa usate oggi per organizzare la casa?' },
    hint: { en: 'Pick all that apply.', it: 'Scegli tutte quelle che valgono.' },
    options: [
      { v: 'whatsapp', en: 'A WhatsApp group', it: 'Un gruppo WhatsApp', icon: 'chat', tone: 'chat' },
      { v: 'splitwise', en: 'Splitwise or Tricount', it: 'Splitwise o Tricount', icon: 'euro', tone: 'money' },
      { v: 'satispay', en: 'Satispay requests', it: 'Richieste Satispay', icon: 'send', tone: 'money' },
      { v: 'paper', en: 'Paper rota or whiteboard', it: 'Turni su carta o lavagna', icon: 'note', tone: 'cleaning' },
      { v: 'landlord_app', en: "The landlord's app (e.g. Joivy)", it: "L'app del proprietario (es. Joivy)", icon: 'home', tone: 'laundry' },
      { v: 'other_app', en: 'Another app', it: "Un'altra app", icon: 'plus', tone: 'quiet',
        follow: { id: 'tools_other', en: 'Which one?', it: 'Quale?' } },
      { v: 'nothing', en: 'Nothing', it: 'Niente', icon: 'x', tone: 'neutral', exclusive: true },
    ],
  },
  {
    id: 'languages', part: 'bonus', type: 'combo', bonus: true,
    title: { en: 'How many languages are spoken in your flat?', it: 'Quante lingue si parlano in casa?' },
    parts: [
      {
        id: 'languages',
        options: [
          { v: '1', en: '1', it: '1' },
          { v: '2', en: '2', it: '2' },
          { v: '3plus', en: '3+', it: '3+' },
        ],
      },
      {
        id: 'misunderstood',
        title: { en: 'Has a message ever been misunderstood?', it: 'Un messaggio è mai stato frainteso?' },
        options: [YES, NO],
      },
    ],
  },
  {
    id: 'price', part: 'bonus', type: 'prices', bonus: true,
    title: { en: 'For the whole flat, per month, at what price would it feel…', it: 'Per tutta la casa, al mese, a che prezzo sarebbe…' },
    hint: { en: 'Rough numbers are fine.', it: 'Vanno bene anche cifre indicative.' },
    fields: [
      { id: 'price_bargain', tone: 'success', en: '…a bargain?', it: '…un affare?' },
      { id: 'price_expensive', tone: 'warning', en: '…like it’s getting expensive?', it: '…un po’ caro?' },
      { id: 'price_too_expensive', tone: 'error', en: '…too expensive to consider?', it: '…troppo caro per pensarci?' },
    ],
  },
  {
    id: 'last_story', part: 'bonus', type: 'text', bonus: true,
    when: (a) => !a.tensions || a.tensions.some((t) => t !== 'nothing'),
    title: { en: 'Tell me about the last time something caused tension. What happened, and how did it end?', it: "Raccontami l'ultima volta che qualcosa ha creato tensione. Cosa è successo e come è finita?" },
    hint: { en: 'A few lines is plenty.', it: 'Bastano poche righe.' },
    placeholder: { en: 'Last week…', it: 'La settimana scorsa…' },
  },
];

// Each screen's icon and module colour: About you in prugna, Flat life in the
// module of its subject, Would you pay in money amber, the bonus in quiet violet.
export const LOOK = {
  you: ['pin', 'chat'],
  tensions: ['bolt', 'money'],
  difficulty: ['clock', 'cleaning'],
  pay_1799: ['bill', 'money'],
  contact: ['send', 'chat'],
  landlord: ['note', 'quiet'],
  flat_size: ['users', 'quiet'],
  tools: ['task', 'quiet'],
  languages: ['globe', 'laundry'],
  price: ['euro', 'money'],
  last_story: ['chat', 'chat'],
};

// Anyone who doesn't live with flatmates finishes after the first screen.
export function endsSurvey(q, answers) {
  return q.id === 'you' && answers.living && answers.living !== 'flatmates';
}

// The tiles shown above the price question
export const CONCEPT = {
  lead: { en: 'Imagine one app for the whole flat:', it: "Immagina un'unica app per tutta la casa:" },
  tiles: [
    { icon: 'sparkle', tone: 'cleaning', en: 'Cleaning turns', it: 'Turni di pulizia' },
    { icon: 'wash', tone: 'laundry', en: 'Washing-machine queue', it: 'Coda lavatrice' },
    { icon: 'euro', tone: 'money', en: 'Shared bills', it: 'Spese comuni' },
    { icon: 'chat', tone: 'chat', en: 'Auto-translated chat', it: 'Chat tradotta' },
  ],
};

export const UI = {
  eyebrow: { en: 'Flock · Flat life survey', it: 'Flock · La vita in casa' },
  welcomeTitle: { en: 'How’s life with your flatmates?', it: 'Com’è la vita con i tuoi coinquilini?' },
  welcomeBody: {
    en: "I'm building an app for people who share a flat in Rome and Milan. Five quick questions, about a minute, anonymous.",
    it: "Sto creando un'app per chi vive in un appartamento condiviso a Roma e Milano. Cinque domande veloci, circa un minuto, in forma anonima.",
  },
  welcomeHonest: {
    en: 'Please be brutally honest: “this isn’t a problem for me” is the most useful answer you can give.',
    it: 'Sii sincero/a al 100%: «per me non è un problema» è la risposta più utile che puoi darmi.',
  },
  minutes: { en: '1 minute', it: '1 minuto' },
  anonymous: { en: 'Anonymous', it: 'Anonimo' },
  privacy: {
    en: 'Answers are stored anonymously and used only to decide what Flock builds.',
    it: 'Le risposte sono salvate in forma anonima e usate solo per decidere cosa costruire in Flock.',
  },
  you: { en: 'you', it: 'tu' },
  start: { en: 'Start', it: 'Inizia' },
  resume: { en: 'Pick up where you left off', it: 'Riprendi da dove eri' },
  next: { en: 'Continue', it: 'Continua' },
  skip: { en: 'Skip', it: 'Salta' },
  finish: { en: 'Finish', it: 'Fine' },
  back: { en: 'Back', it: 'Indietro' },
  send: { en: 'Send answers', it: 'Invia le risposte' },
  sending: { en: 'Sending…', it: 'Invio…' },
  pressEnter: { en: 'press Enter', it: 'premi Invio' },
  perMonth: { en: '€ / month', it: '€ / mese' },
  priceOrder: {
    en: 'Usually a bargain is lower than expensive, and expensive is lower than too expensive. Want to check?',
    it: 'Di solito «un affare» costa meno di «un po’ caro», e «un po’ caro» meno di «troppo caro». Vuoi ricontrollare?',
  },
  sendError: {
    en: "Couldn't send your answers. Check your connection and try again.",
    it: 'Non riesco a inviare le risposte. Controlla la connessione e riprova.',
  },
  retry: { en: 'Retry', it: 'Riprova' },
  doneTitle: { en: 'Grazie! That really helps.', it: 'Grazie! Mi aiuta davvero.' },
  doneBody: {
    en: 'Your answers are in. One last favour: send this to your flatmates. What the whole flat thinks matters more than one person.',
    it: 'Le tue risposte sono arrivate. Un ultimo favore: mandalo ai tuoi coinquilini. Conta cosa pensa tutta la casa, non una persona sola.',
  },
  doneContact: { en: "We'll message you when Flock is ready to try.", it: 'Ti scriveremo quando Flock sarà pronta da provare.' },
  bonusTitle: { en: 'Got one more minute?', it: 'Hai ancora un minuto?' },
  bonusBody: { en: 'A few extra questions about your flat. Skip any you like.', it: 'Qualche domanda in più sulla tua casa. Salta quelle che vuoi.' },
  bonusDone: { en: 'Bonus answers saved too. Thank you!', it: 'Salvate anche le risposte bonus. Grazie!' },
  outTitle: { en: 'Thanks! This one’s for flatmates.', it: 'Grazie! Questo è per chi vive con coinquilini.' },
  outBody: {
    en: 'Know someone who shares a flat? Send them the survey. It takes a minute.',
    it: 'Conosci qualcuno che vive in un appartamento condiviso? Mandagli il sondaggio. Ci vuole un minuto.',
  },
  whatsapp: { en: 'Send on WhatsApp', it: 'Manda su WhatsApp' },
  share: { en: 'Share', it: 'Condividi' },
  copy: { en: 'Copy link', it: 'Copia link' },
  copied: { en: 'Link copied', it: 'Link copiato' },
  again: { en: 'Answer again', it: 'Rispondi di nuovo' },
  shareText: {
    en: "I'm answering a 1-minute survey about living with flatmates. Can you fill it in too?",
    it: 'Sto rispondendo a un sondaggio di un minuto sulla vita con i coinquilini. Lo compili anche tu?',
  },
};
