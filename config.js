// Public by design: the publishable key can only call public.submit_survey(),
// which writes to research.survey_responses. Nothing can be read back with it.
export const SUPABASE_URL = 'https://cuhbeomfypzhvwcqavmw.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_M1VoyQMzQWttMUuqjdfeQw_WS7NJy7K';
// Bump when the questions change, so results from different versions stay apart.
export const SURVEY_ID = 'flatlife-v2';
