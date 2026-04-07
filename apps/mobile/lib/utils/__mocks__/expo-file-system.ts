export const documentDirectory = 'file://documents/';
export const copyAsync = async () => {};
export const deleteAsync = async () => {};
export const getInfoAsync = async () => ({ exists: true });
const FileSystem = {
  documentDirectory,
  copyAsync,
  deleteAsync,
  getInfoAsync,
};
export default FileSystem;
