import { createServer } from 'net';

/**
 * Find an available port starting from a preferred port
 * @param preferredPort - The port to try first
 * @returns Promise resolving to an available port number
 */
export const findAvailablePort = (preferredPort: number): Promise<number> => {
  return new Promise((resolve, reject) => {
    const server = createServer();
    
    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        // Port is in use, try next port
        resolve(findAvailablePort(preferredPort + 1));
      } else {
        reject(err);
      }
    });
    
    server.once('listening', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => resolve(preferredPort));
      }
    });
    
    server.listen(preferredPort, '127.0.0.1');
  });
};

/**
 * Check if a port is available
 * @param port - Port number to check
 * @returns Promise resolving to boolean
 */
export const isPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = createServer();
    
    server.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    
    server.listen(port, '127.0.0.1');
  });
};