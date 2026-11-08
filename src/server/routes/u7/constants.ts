/**
 * U7's tunable numbers, in one place (plan "All the numbers"). Rules: BR5.2 to BR5.4 (limits),
 * BR7.2 and BR7.6 (list lengths).
 */

/** BR5.2: an item name and a category name, 1 to this many characters after trimming. */
export const NAME_MAX = 60;
/** BR5.2: a description is at most this long. */
export const DESCRIPTION_MAX = 300;
/** BR5.2: price_cents from 1 to this. */
export const PRICE_MAX_CENTS = 1_000_000;
/** BR5.2: an emoji image has at most this many characters. */
export const IMAGE_EMOJI_MAX = 8;
/** BR5.2: an image web address has at most this many characters. */
export const IMAGE_URL_MAX = 500;
/** BR5.4: option group limits. */
export const GROUPS_MAX = 6;
export const CHOICES_MAX = 12;
export const OPTION_NAME_MAX = 60;
export const PRICE_DELTA_MAX_CENTS = 100_000;

/** BR7.2: best sellers listed per day. */
export const BEST_SELLERS_TOP = 5;
/** BR7.6: best and worst rated dishes listed. */
export const RATED_TOP = 3;
/** BR7.6: the tie rule, stated in words in every answer. */
export const RATING_TIE_RULE =
  'Ranked by the share of thumbs up. Ties go to the dish with more ratings, then to the name in alphabetical order.';

/** An invalid date text in sales or ratings. */
export const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
