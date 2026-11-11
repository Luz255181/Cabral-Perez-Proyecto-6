import http from 'k6/http';
import { check, group, sleep } from 'k6';

// Configuración de la Prueba de Punto de Quiebre (Stress / Breakpoint Test)
export const options = {
  // Incremento continuo de carga de 10 a 500 VUs para hallar el punto de quiebre (knee point)
  stages: [
    { duration: '1m', target: 50 },   // Ramp-up inicial a 50 VUs
    { duration: '2m', target: 100 },  // Incremento a 100 VUs
    { duration: '2m', target: 250 },  // Incremento a 250 VUs
    { duration: '2m', target: 500 },  // Carga máxima de 500 VUs
    { duration: '1m', target: 0 },    // Bajada final
  ],

  thresholds: {
    'http_req_duration': ['p(95)<400'],
    'http_req_failed': ['rate<0.01'],
    'checks': ['rate>0.99'],
  },
};

const BASE_URL = 'https://simple-books-api.click';

export default function () {
  // Grupo 1: Estado del servicio
  group('01. Verificar Estado de API', function () {
    const res = http.get(`${BASE_URL}/status`, { tags: { name: 'GET /status' } });
    check(res, {
      'status es 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 2 + 1);

  // Grupo 2: Exploración del Catálogo
  group('02. Consultar Catálogo de Libros', function () {
    const resAll = http.get(`${BASE_URL}/books`, { tags: { name: 'GET /books' } });
    check(resAll, {
      'status es 200': (r) => r.status === 200,
    });

    const resFiltered = http.get(`${BASE_URL}/books?type=fiction&limit=5`, { 
      tags: { name: 'GET /books?type=fiction' } 
    });
    check(resFiltered, {
      'status es 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 2 + 1);

  // Grupo 3: Detalle de un libro específico
  group('03. Ver Detalle de Libro', function () {
    const resBook = http.get(`${BASE_URL}/books/1`, { tags: { name: 'GET /books/:id' } });
    check(resBook, {
      'status es 200': (r) => r.status === 200,
    });
  });

  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'summary_stress_casual.json': JSON.stringify(data, null, 2),
  };
}
