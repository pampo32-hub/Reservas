// Datos iniciales de demostración para el directorio y reservas

export const INITIAL_CATEGORIES = [
  { id: 'all', name: 'Todas las Categorías', icon: 'fa-store' },
  { id: 'belleza', name: 'Belleza y Barbería', icon: 'fa-scissors' },
  { id: 'salud', name: 'Salud y Bienestar', icon: 'fa-stethoscope' },
  { id: 'spa', name: 'Spa y Masajes', icon: 'fa-spa' },
  { id: 'fitness', name: 'Fitness y Deporte', icon: 'fa-dumbbell' },
  { id: 'autos', name: 'Talleres y Autos', icon: 'fa-car' },
  { id: 'fotografia', name: 'Fotografía y Eventos', icon: 'fa-camera' }
];

export const INITIAL_BUSINESSES = [
  {
    id: 'biz-1',
    name: 'Barbería & Estilo Vintage',
    category: 'belleza',
    categoryLabel: 'Belleza y Barbería',
    rating: 4.9,
    reviewsCount: 128,
    priceRange: '$$',
    address: 'Av. Central 452, Zona Centro',
    city: 'Ciudad de México',
    phone: '+52 55 1234 5678',
    email: 'contacto@barberiavintage.com',
    description: 'Especialistas en cortes clásicos, degradados modernos, arreglo de barba con toalla caliente y tratamientos capilares para caballeros.',
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=80',
    schedule: {
      days: [1, 2, 3, 4, 5, 6], // 0: Dom, 1: Lun, 2: Mar, 3: Mie, 4: Jue, 5: Vie, 6: Sab
      openTime: '09:00',
      closeTime: '20:00',
      breakStart: '14:00',
      breakEnd: '15:00',
      slotDuration: 30 // minutos
    },
    services: [
      { id: 'srv-101', name: 'Corte de Cabello Clásico', duration: 30, price: 180, description: 'Corte personalizado, lavado y peinado con cera mate.' },
      { id: 'srv-102', name: 'Arreglo y Perfilado de Barba', duration: 30, price: 140, description: 'Toalla caliente, aceites esenciales, afeitado a navaja y bálsamo.' },
      { id: 'srv-103', name: 'Combo Premium (Corte + Barba)', duration: 60, price: 290, description: 'La experiencia completa: corte, barba, exfoliación y masaje capilar.' },
      { id: 'srv-104', name: 'Tinte de Barba o Canas', duration: 45, price: 200, description: 'Cobertura natural de canas con productos sin amoníaco.' }
    ]
  },
  {
    id: 'biz-2',
    name: 'Clínica Dental Sonrisas & Salud',
    category: 'salud',
    categoryLabel: 'Salud y Bienestar',
    rating: 4.8,
    reviewsCount: 94,
    priceRange: '$$$',
    address: 'Calle Los Robles 789, Consultorio 304',
    city: 'Guadalajara',
    phone: '+52 33 9876 5432',
    email: 'citas@dentalsonrisas.com',
    description: 'Cuidado dental integral de alta tecnología. Limpiezas ultrasónicas, blanqueamiento led, ortodoncia invisible y odontopediatría.',
    image: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1200&q=80',
    schedule: {
      days: [1, 2, 3, 4, 5],
      openTime: '08:30',
      closeTime: '18:00',
      breakStart: '13:30',
      breakEnd: '14:30',
      slotDuration: 45
    },
    services: [
      { id: 'srv-201', name: 'Valoración y Diagnóstico Dental', duration: 30, price: 250, description: 'Revisión con cámara intraoral y plan de tratamiento personalizado.' },
      { id: 'srv-202', name: 'Limpieza Dental Ultrasonido', duration: 45, price: 550, description: 'Eliminación de sarro profundo, pulido dental y aplicación de flúor.' },
      { id: 'srv-203', name: 'Blanqueamiento Dental LED', duration: 60, price: 1800, description: 'Sesión intensiva para aclarar hasta 4 tonos en una sola visita.' },
      { id: 'srv-204', name: 'Consulta de Ortodoncia / Brackets', duration: 45, price: 400, description: 'Evaluación para alineación dental e invisalign.' }
    ]
  },
  {
    id: 'biz-3',
    name: 'Serenity Spa & Masajes Holísticos',
    category: 'spa',
    categoryLabel: 'Spa y Masajes',
    rating: 5.0,
    reviewsCount: 210,
    priceRange: '$$$',
    address: 'Paseo de la Luna 102, Col. Del Valle',
    city: 'Monterrey',
    phone: '+52 81 4567 8901',
    email: 'relax@serenityspa.com',
    description: 'Un oasis de relajación en la ciudad. Tratamientos corporales, masajes relajantes y descontracturantes con piedras calientes y aromaterapia.',
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=1200&q=80',
    schedule: {
      days: [1, 2, 3, 4, 5, 6, 0], // Todos los días
      openTime: '10:00',
      closeTime: '20:00',
      breakStart: '14:00',
      breakEnd: '15:00',
      slotDuration: 60
    },
    services: [
      { id: 'srv-301', name: 'Masaje Relajante con Aromaterapia', duration: 60, price: 650, description: 'Masaje suave con aceites de lavanda para liberar el estrés y tensión.' },
      { id: 'srv-302', name: 'Masaje Descontracturante Profundo', duration: 60, price: 750, description: 'Técnica focalizada en nudos musculares en espalda, cuello y hombros.' },
      { id: 'srv-303', name: 'Terapia con Piedras Calientes', duration: 75, price: 900, description: 'Piedras volcánicas a temperatura ideal para calmar el sistema nervioso.' },
      { id: 'srv-304', name: 'Facial Hidratante y Rejuvenecedor', duration: 45, price: 580, description: 'Limpieza profunda, mascarilla de colágeno y serum de ácido hialurónico.' }
    ]
  },
  {
    id: 'biz-4',
    name: 'AutoCheck Taller Mecánico Especializado',
    category: 'autos',
    categoryLabel: 'Talleres y Autos',
    rating: 4.7,
    reviewsCount: 76,
    priceRange: '$$',
    address: 'Av. Industrial 830, Parque Norte',
    city: 'Querétaro',
    phone: '+52 442 112 3344',
    email: 'servicio@autocheck.mx',
    description: 'Mantenimiento preventivo, afinaciones mayores, diagnóstico por computadora, frenos y suspensión multimarca con garantía escrita.',
    image: 'https://images.unsplash.com/photo-1613214149922-f1809c99b414?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=1200&q=80',
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '08:00',
      closeTime: '18:00',
      breakStart: '13:00',
      breakEnd: '14:00',
      slotDuration: 60
    },
    services: [
      { id: 'srv-401', name: 'Diagnóstico por Escáner Computarizado', duration: 30, price: 300, description: 'Lectura de códigos de falla OBD2 y revisión de sensores.' },
      { id: 'srv-402', name: 'Afinación Menor (Aceite y Filtros)', duration: 60, price: 950, description: 'Cambio de aceite sintético, filtro de aceite y filtro de aire.' },
      { id: 'srv-403', name: 'Servicio de Frenos Delanteros y Traseros', duration: 90, price: 1200, description: 'Rectificado de discos, cambio de balatas y purgado de líquido.' }
    ]
  }
];

export const INITIAL_APPOINTMENTS = [
  {
    id: 'apt-001',
    businessId: 'biz-1',
    serviceId: 'srv-101',
    serviceName: 'Corte de Cabello Clásico',
    servicePrice: 180,
    serviceDuration: 30,
    date: new Date().toISOString().split('T')[0], // Hoy
    time: '10:00',
    clientName: 'Carlos Mendoza',
    clientPhone: '+52 55 9988 7766',
    clientEmail: 'carlos.m@example.com',
    notes: 'Preferencia corte fade bajo.',
    status: 'confirmed', // pending, confirmed, completed, cancelled
    createdAt: new Date().toISOString()
  },
  {
    id: 'apt-002',
    businessId: 'biz-1',
    serviceId: 'srv-103',
    serviceName: 'Combo Premium (Corte + Barba)',
    servicePrice: 290,
    serviceDuration: 60,
    date: new Date().toISOString().split('T')[0], // Hoy
    time: '11:30',
    clientName: 'Alejandro Rivera',
    clientPhone: '+52 55 3344 5566',
    clientEmail: 'alejandro.r@example.com',
    notes: 'Primera visita al local.',
    status: 'pending',
    createdAt: new Date().toISOString()
  },
  {
    id: 'apt-003',
    businessId: 'biz-3',
    serviceId: 'srv-301',
    serviceName: 'Masaje Relajante con Aromaterapia',
    servicePrice: 650,
    serviceDuration: 60,
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Mañana
    time: '16:00',
    clientName: 'Mariana Gómez',
    clientPhone: '+52 81 1234 9988',
    clientEmail: 'mariana.g@example.com',
    notes: 'Enfoque en zona lumbar.',
    status: 'confirmed',
    createdAt: new Date().toISOString()
  }
];

