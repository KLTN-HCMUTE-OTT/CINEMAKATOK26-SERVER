import { LOG_ACTION } from "../enums/log.enum";

const ACTION_DESCRIPTIONS: Partial<Record<LOG_ACTION, string>> = {
  [LOG_ACTION.USER_LOGIN]: 'User logged in to the system',
  [LOG_ACTION.USER_LOGOUT]: 'User logged out of the system',
  [LOG_ACTION.USER_REGISTRATION]: 'User registered an account',
  [LOG_ACTION.CHANGE_PASSWORD]: 'User changed their password',
  [LOG_ACTION.PASSWORD_RESET]: 'User reset their password',
  [LOG_ACTION.EMAIL_VERIFICATION]: 'User verified their email',
  [LOG_ACTION.USER_BAN]: 'User account was banned',
  [LOG_ACTION.USER_UNBAN]: 'User account was unbanned',
  [LOG_ACTION.PLAY_MOVIE]: 'User played a movie',
  [LOG_ACTION.PLAY_EPISODE_OF_SERIES]: 'User played an episode of a series',
  [LOG_ACTION.LIKE_MOVIE]: 'User liked a movie',
  [LOG_ACTION.LIKE_SERIES]: 'User liked a series',
  [LOG_ACTION.UNLIKE_MOVIE]: 'User unliked a movie',
  [LOG_ACTION.UNLIKE_SERIES]: 'User unliked a series',
  [LOG_ACTION.ADD_MOVIE_TO_WATCHLIST]: 'User added a movie to watchlist',
  [LOG_ACTION.ADD_SERIES_TO_WATCHLIST]: 'User added a series to watchlist',
  [LOG_ACTION.REMOVE_MOVIE_FROM_WATCHLIST]: 'User removed a movie from watchlist',
  [LOG_ACTION.REMOVE_SERIES_FROM_WATCHLIST]: 'User removed a series from watchlist',
  [LOG_ACTION.CREATE_REVIEW]: 'User wrote a review',
  [LOG_ACTION.UPDATE_REVIEW]: 'User updated a review',
  [LOG_ACTION.DELETE_REVIEW]: 'User deleted a review',
};

export function resolveDescription(action: LOG_ACTION, metadata?: Record<string, any>): string {
  if (metadata?.description) return metadata.description;
  return ACTION_DESCRIPTIONS[action] ?? action.replace(/_/g, ' ').toLowerCase();
}