import http from 'k6/http';
import { check, group, sleep } from 'k6';

// Configuración de la prueba y Umbrales (Thresholds)
export const options = {
  // Etapas del Load Test: Ramp-up (2m), Steady state (5m), Ramp-down (1m)
  stages: [
    { duration: '2m', target: 20 }, // Sube gradualmente a 20 usuarios virtuales en 2 min
    { duration: '5m', target: 20 }, // Mantiene 20 usuarios constantes durante 5 min
    { duration: '1m', target: 0  }, // Baja gradualmente a 0 en 1 min
  ],

  // Criterios de aprobación según la consigna del proyecto
  thresholds: {
    'http_req_duration': ['p(95)<400'], // El 95% de las respuestas en menos de 400ms
    'http_req_failed': ['rate<0.01'],    // Errores HTTP < 1%
    'checks': ['rate>0.99'],             // Aserciones exitosas > 99%
  },
};

const BASE_URL = 'https://simple-books-api.click';

// Función principal que ejecuta cada Usuario Virtual (VU)
export default function () {
  
  // Grupo 1: Estado del servicio
  group('01. Verificar Estado de API', function () {
    const res = http.get(`${BASE_URL}/status`, { tags: { name: 'GET /status' } });
    
    check(res, {
      'status es 200': (r) => r.status === 200,
    });
  });

  // Pausa humana aleatoria entre 1 y 3 segundos (think time)
  sleep(Math.random() * 2 + 1);

  // Grupo 2: Exploración del Catálogo
  group('02. Consultar Catálogo de Libros', function () {
    // Consulta sin filtro
    const resAll = http.get(`${BASE_URL}/books`, { tags: { name: 'GET /books' } });
    check(resAll, {
      'status es 200': (r) => r.status === 200,
    });

    // Consulta con filtro (ficción y límite de 5)
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
      'tiene ID de libro': (r) => r.json().id === 1,
    });
  });

  sleep(Math.random() * 2 + 1);
}
