let ioInstance = null;

export const setSocketIO = (io) => {
  ioInstance = io;
  return ioInstance;
};

export const getSocketIO = () => ioInstance;

