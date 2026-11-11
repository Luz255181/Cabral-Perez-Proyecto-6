import http from 'k6/http';
import { check, group, sleep } from 'k6';

// Escenario de Avalancha (Spike Test) - Perfil Casual
export const options = {
  stages: [
    { duration: '10s', target: 5 },    // Tráfico normal inicial
    { duration: '10s', target: 100 },  // Salto brusco de 5 a 100 VUs en 10s (Spike)
    { duration: '3m',  target: 100 },  // Mantiene el pico de 100 VUs durante 3 min
    { duration: '10s', target: 5 },    // Bajada rápida para evaluar si se recupera
    { duration: '3m',  target: 5 },    // Período de observación de recuperación
  ],

  thresholds: {
    'http_req_duration': ['p(95)<400'],
    'http_req_failed': ['rate<0.01'],
    'checks': ['rate>0.99'],
  },
};

const BASE_URL = 'https://simple-books-api.click';

export default function () {
  group('01. Verificar Estado de API', function () {
    const res = http.get(`${BASE_URL}/status`, { tags: { name: 'GET /status' } });
    check(res, { 'status es 200': (r) => r.status === 200 });
  });

  sleep(Math.random() * 2 + 1);

  group('02. Consultar Catálogo de Libros', function () {
    const resAll = http.get(`${BASE_URL}/books`, { tags: { name: 'GET /books' } });
    check(resAll, { 'status es 200': (r) => r.status === 200 });

    const resFiltered = http.get(`${BASE_URL}/books?type=fiction&limit=5`, { 
      tags: { name: 'GET /books?type=fiction' } 
    });
    check(resFiltered, { 'status es 200': (r) => r.status === 200 });
  });

  sleep(Math.random() * 2 + 1);

  group('03. Ver Detalle de Libro', function () {
    const resBook = http.get(`${BASE_URL}/books/1`, { tags: { name: 'GET /books/:id' } });
    check(resBook, {
      'status es 200': (r) => r.status === 200,
      'tiene ID de libro': (r) => r.json().id === 1,
    });
  });

  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'summary_spike_casual.json': JSON.stringify(data, null, 2),
  };
}
