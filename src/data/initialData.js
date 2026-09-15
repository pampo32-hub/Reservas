// Datos iniciales de demostración en Colones costarricenses (₡ CRC)

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
    priceRange: '₡₡',
    address: 'Av. Escazú, Local 12',
    city: 'San José, Escazú',
    phone: '+506 8877 6655',
    email: 'contacto@barberiavintage.cr',
    description: 'Especialistas en cortes clásicos, degradados modernos, arreglo de barba con toalla caliente y tratamientos capilares para caballeros.',
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Sinpe Móvil', 'Parqueo Gratis', 'Aire Acondicionado', 'Café de Cortesía', 'WiFi Gratis'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6], // 1: Lun, 2: Mar, 3: Mie, 4: Jue, 5: Vie, 6: Sab
      openTime: '09:00',
      closeTime: '20:00',
      breakStart: '13:00',
      breakEnd: '14:00',
      slotDuration: 30 // minutos
    },
    services: [
      { id: 'srv-101', name: 'Corte de Cabello Clásico', duration: 30, price: 7000, description: 'Corte personalizado, lavado y peinado con cera mate.' },
      { id: 'srv-102', name: 'Arreglo y Perfilado de Barba', duration: 30, price: 5000, description: 'Toalla caliente, aceites esenciales, afeitado a navaja y bálsamo.' },
      { id: 'srv-103', name: 'Combo Premium (Corte + Barba)', duration: 60, price: 11000, description: 'La experiencia completa: corte, barba, exfoliación y masaje capilar.' },
      { id: 'srv-104', name: 'Tinte de Barba o Canas', duration: 45, price: 8000, description: 'Cobertura natural de canas con productos sin amoníaco.' }
    ]
  },
  {
    id: 'biz-2',
    name: 'Clínica Dental Sonrisas & Salud',
    category: 'salud',
    categoryLabel: 'Salud y Bienestar',
    rating: 4.8,
    reviewsCount: 94,
    priceRange: '₡₡₡',
    address: 'Frente a Paseo de las Flores, Consultorio 204',
    city: 'Heredia',
    phone: '+506 2260 1234',
    email: 'citas@dentalsonrisas.cr',
    description: 'Cuidado dental integral de alta tecnología. Limpiezas ultrasónicas, blanqueamiento led, ortodoncia invisible y odontopediatría.',
    image: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Acepta Tarjeta', 'Sinpe Móvil', 'Parqueo Bajo Techo', 'Acceso Silla de Ruedas', 'Emergencias 24/7'],
    schedule: {
      days: [1, 2, 3, 4, 5],
      openTime: '08:30',
      closeTime: '18:00',
      breakStart: '12:30',
      breakEnd: '13:30',
      slotDuration: 45
    },
    services: [
      { id: 'srv-201', name: 'Valoración y Diagnóstico Dental', duration: 30, price: 15000, description: 'Revisión completa con cámara intraoral y presupuesto detallado.' },
      { id: 'srv-202', name: 'Limpieza Dental con Ultrasonido', duration: 45, price: 25000, description: 'Eliminación profunda de sarro, profilaxis y aplicación de flúor.' },
      { id: 'srv-203', name: 'Blanqueamiento Dental LED', duration: 60, price: 75000, description: 'Sesión intensiva para aclarar hasta 4 tonos en una sola visita.' },
      { id: 'srv-204', name: 'Consulta de Ortodoncia / Brackets', duration: 45, price: 20000, description: 'Evaluación personalizada para alineación e invisalign.' }
    ]
  },
  {
    id: 'biz-3',
    name: 'Serenity Spa & Masajes Holísticos',
    category: 'spa',
    categoryLabel: 'Spa y Masajes',
    rating: 5.0,
    reviewsCount: 210,
    priceRange: '₡₡₡',
    address: 'Barrio Escalante, 100m Este del Parque Francia',
    city: 'San José',
    phone: '+506 8765 4321',
    email: 'relax@serenityspa.cr',
    description: 'Un oasis de relajación en la ciudad. Tratamientos corporales, masajes relajantes y descontracturantes con piedras calientes y aromaterapia.',
    image: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1600334089648-b0d9d3028eb2?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Aromaterapia', 'Cabinas Privadas', 'Música Relajante', 'Sinpe Móvil', 'Té de Bienvenida'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6, 0],
      openTime: '10:00',
      closeTime: '20:00',
      breakStart: '13:00',
      breakEnd: '14:00',
      slotDuration: 60
    },
    services: [
      { id: 'srv-301', name: 'Masaje Relajante con Aromaterapia', duration: 60, price: 22000, description: 'Masaje suave con aceites de lavanda para liberar el estrés y tensión.' },
      { id: 'srv-302', name: 'Masaje Descontracturante Profundo', duration: 60, price: 26000, description: 'Técnica focalizada en nudos musculares en espalda, cuello y hombros.' },
      { id: 'srv-303', name: 'Terapia con Piedras Volcánicas Calientes', duration: 75, price: 32000, description: 'Piedras a temperatura ideal para calmar el sistema nervioso.' },
      { id: 'srv-304', name: 'Facial Hidratante y Rejuvenecedor', duration: 45, price: 20000, description: 'Limpieza profunda, mascarilla de colágeno y serum de ácido hialurónico.' }
    ]
  },
  {
    id: 'biz-4',
    name: 'AutoCheck Taller Mecánico Especializado',
    category: 'autos',
    categoryLabel: 'Talleres y Autos',
    rating: 4.7,
    reviewsCount: 76,
    priceRange: '₡₡',
    address: 'Radial Alajuela, 300m Norte de Plaza Real',
    city: 'Alajuela',
    phone: '+506 2440 9876',
    email: 'servicio@autocheck.cr',
    description: 'Mantenimiento preventivo, cambio de fluidos, diagnóstico computarizado, frenos y suspensión multimarca con garantía.',
    image: 'https://images.unsplash.com/photo-1613214149922-f1809c99b414?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Sala de Espera con A/C', 'Garantía por Escrito', 'Sinpe Móvil', 'Scanner OBD2 Avanzado'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '08:00',
      closeTime: '17:30',
      breakStart: '12:00',
      breakEnd: '13:00',
      slotDuration: 60
    },
    services: [
      { id: 'srv-401', name: 'Diagnóstico por Escáner Computarizado', duration: 30, price: 15000, description: 'Lectura de códigos de falla OBD2 y revisión de sensores.' },
      { id: 'srv-402', name: 'Afinación Menor (Aceite Sintético + Filtros)', duration: 60, price: 42000, description: 'Cambio de aceite 100% sintético, filtro de aceite y filtro de aire.' },
      { id: 'srv-403', name: 'Servicio de Frenos Completo', duration: 90, price: 55000, description: 'Rectificado de discos, cambio de pastillas y purgado de líquido.' }
    ]
  }
];

export const INITIAL_APPOINTMENTS = [
  {
    id: 'apt-001',
    businessId: 'biz-1',
    serviceId: 'srv-101',
    serviceName: 'Corte de Cabello Clásico',
    servicePrice: 7000,
    serviceDuration: 30,
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    clientName: 'Carlos Mendoza',
    clientPhone: '+506 8899 1122',
    clientEmail: 'carlos.m@example.com',
    notes: 'Preferencia corte fade bajo.',
    status: 'confirmed',
    createdAt: new Date().toISOString()
  },
  {
    id: 'apt-002',
    businessId: 'biz-1',
    serviceId: 'srv-103',
    serviceName: 'Combo Premium (Corte + Barba)',
    servicePrice: 11000,
    serviceDuration: 60,
    date: new Date().toISOString().split('T')[0],
    time: '11:30',
    clientName: 'Alejandro Rivera',
    clientPhone: '+506 8765 1234',
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
    servicePrice: 22000,
    serviceDuration: 60,
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    time: '16:00',
    clientName: 'Mariana Gómez',
    clientPhone: '+506 7011 2233',
    clientEmail: 'mariana.g@example.com',
    notes: 'Enfoque en zona lumbar.',
    status: 'confirmed',
    createdAt: new Date().toISOString()
  }
];
