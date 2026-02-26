const { createServer } = require('node:http');
const { parse } = require('node:url');
const next = require('next');

const dev = false;
const hostname = '0.0.0.0';
const port = Number(process.env.PORT) || 3001;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, () => {
      console.log(`Fluxcy Web escuchando en http://${hostname}:${port}`);
    });
  })
  .catch((error) => {
    console.error('Error iniciando servidor Next.js', error);
    process.exit(1);
  });
