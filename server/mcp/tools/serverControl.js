/**
 * MCP tool for server control: start-webserver
 */

const { z } = require('zod');
const path = require('node:path');
const { spawn } = require('node:child_process');
const net = require('node:net');

function registerServerControlTools(server, { config }) {
  server.tool(
    'start-webserver',
    {
      port: z.number().int('Port must be an integer').min(1024, 'Port must be at least 1024').max(65535, 'Port must be at most 65535').optional().default(3001)
    },
    async ({ port }) => {
      try {
        const isPortInUse = await new Promise((resolve) => {
          const tester = net.createServer()
            .once('error', () => resolve(true))
            .once('listening', () => {
              tester.once('close', () => resolve(false));
              tester.close();
            })
            .listen(port);
        });

        if (isPortInUse) {
          return {
            content: [{
              type: 'text',
              text: `Error: Port ${port} is already in use. Please specify a different port.`
            }],
            isError: true
          };
        }

        const serverPath = path.resolve(__dirname, '../server.js');

        const serverProcess = spawn('node', [serverPath], {
          env: { ...process.env, PORT: port.toString() },
          detached: true,
          stdio: 'ignore'
        });

        serverProcess.unref();

        await new Promise(resolve => setTimeout(resolve, 500));

        if (serverProcess.exitCode !== null) {
          return {
            content: [{
              type: 'text',
              text: `Error: Server failed to start (exit code: ${serverProcess.exitCode})`
            }],
            isError: true
          };
        }

        return {
          content: [{
            type: 'text',
            text: `Kanban web server started on port ${port}. You can access it at http://localhost:${port}`
          }]
        };
      } catch (error) {
        console.error('Error in start-webserver tool:', error);
        return {
          content: [{ type: 'text', text: `Error starting Kanban web server: ${error.message}` }],
          isError: true
        };
      }
    }
  );
}

module.exports = { registerServerControlTools };
