// Simple encryption utility (for demonstration only)
// In production, use proper encryption libraries

export const encryptPassword = (password: string): string => {
  // Simple base64 encoding (NOT secure for production)
  return Buffer.from(password).toString('base64');
};

export const decryptPassword = (encryptedPassword: string): string => {
  // Simple base64 decoding (NOT secure for production)
  return Buffer.from(encryptedPassword, 'base64').toString('utf-8');
};

// Better approach: Use bcrypt or similar
// npm install bcrypt
// import bcrypt from 'bcrypt';
// 
// export const hashPassword = async (password: string): Promise<string> => {
//   return await bcrypt.hash(password, 10);
// };
// 
// export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
//   return await bcrypt.compare(password, hash);
// };