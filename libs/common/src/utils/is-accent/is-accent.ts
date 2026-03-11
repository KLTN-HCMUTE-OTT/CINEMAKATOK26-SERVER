export const isAccent = (str: string): boolean => {
  const AccentRegex = /[\u00C0-\u00FF\u0102-\u0103\u0110\u0111\u0128\u0129\u1EA0-\u1EF9]/; // Matches accented characters in Latin-1 Supplement
  return AccentRegex.test(str);
};
