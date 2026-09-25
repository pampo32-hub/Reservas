export const SUBSCRIPTION_PLANS = [
  {
    id: 'free',
    name: 'Plan Gratis',
    badge: '100% Gratis',
    priceUsd: 0,
    originalPriceUsd: 0,
    priceCrc: 0,
    interval: 'de por vida',
    bookingLimit: 25,
    bookingLimitLabel: '25 reservas / mes',
    staffLimit: 1,
    staffLimitLabel: '1 profesional (dueño)',
    tagline: 'Comienza a digitalizar tus citas hoy sin costo para siempre.',
    features: [
      'Hasta 25 reservas mensuales de por vida',
      '1 especialista (dueño único)',
      'Catálogo con hasta 5 servicios',
      'Tu enlace propio para Instagram y TikTok',
      'Confirmaciones por correo electrónico',
      'Sin contratos ni tarjeta de crédito'
    ],
    popular: false,
    color: 'emerald'
  },
  {
    id: 'basic',
    name: 'Plan Básico',
    badge: 'Emprendedor',
    priceUsd: 10,
    originalPriceUsd: 15,
    priceCrc: 5200,
    interval: 'mensual',
    bookingLimit: 150,
    bookingLimitLabel: '150 reservas / mes',
    staffLimit: 1,
    staffLimitLabel: '1 profesional (dueño)',
    tagline: 'Ideal para independientes y negocios unipersonales.',
    features: [
      'Hasta 150 reservas mensuales',
      '1 especialista / operador (dueño único)',
      'Catálogo con todos tus servicios y precios',
      'Confirmación automática por correo',
      'Enlace directo a tu perfil para Instagram, TikTok y WhatsApp',
      'Agenda digital y gestión de citas en tiempo real'
    ],
    popular: false,
    color: 'blue'
  },
  {
    id: 'pro',
    name: 'Plan Profesional',
    badge: 'Más Popular',
    priceUsd: 18,
    originalPriceUsd: 25,
    priceCrc: 9400,
    interval: 'mensual',
    bookingLimit: 300,
    bookingLimitLabel: '300 reservas / mes',
    staffLimit: 5,
    staffLimitLabel: 'Hasta 5 especialistas',
    tagline: 'Perfecto para barberías, salones, spas, clínicas y talleres en crecimiento.',
    features: [
      'Hasta 300 reservas mensuales',
      'Hasta 5 empleados / especialistas con horarios propios',
      'Todo lo incluido en el Plan Básico',
      'Confirmación automática por WhatsApp y correo',
      'Reportes de ingresos y estadísticas de clientes frecuentes',
      'Horarios avanzados (bloqueo de descansos, almuerzo y feriados)',
      'Insignia oficial de Negocio Verificado en el directorio'
    ],
    popular: true,
    color: 'amber'
  },
  {
    id: 'unlimited',
    name: 'Plan Ilimitado',
    badge: 'Sin Límites',
    priceUsd: 35,
    originalPriceUsd: 45,
    priceCrc: 18200,
    interval: 'mensual',
    bookingLimit: null,
    bookingLimitLabel: 'Reservas Ilimitadas',
    staffLimit: null,
    staffLimitLabel: 'Especialistas ilimitados',
    tagline: 'Para negocios con alto flujo de clientes y equipos grandes sin restricciones.',
    features: [
      'Reservas 100% Ilimitadas al mes (sin topes)',
      'Especialistas y colaboradores ilimitados',
      'Todo lo incluido en el Plan Profesional',
      'Posición preferencial en el buscador del directorio',
      'Aparición destacada en comercios recomendados de la portada',
      'Historial completo y base de datos de clientes'
    ],
    popular: false,
    color: 'purple'
  }
];

export const TEST_SUBSCRIPTION_PLANS = [
  {
    id: 'test_5',
    name: 'Plan Micro Test',
    badge: 'Prueba SINPE ₡5',
    priceUsd: 0.01,
    originalPriceUsd: 10,
    priceCrc: 5,
    interval: 'pago de prueba',
    bookingLimit: 50,
    bookingLimitLabel: '50 reservas de prueba',
    staffLimit: 2,
    staffLimitLabel: 'Hasta 2 especialistas',
    tagline: 'Plan exclusivo para probar pasarelas y validaciones automáticas de SINPE Móvil con ₡5.',
    features: [
      'Monto de prueba simbólico de ₡5 colones',
      'Validación y conciliación instantánea por SINPE',
      'Confirmación de reserva inmediata por correo y WhatsApp',
      'Hasta 50 citas simuladas de prueba',
      'Acceso completo a la agenda y calendario'
    ],
    popular: false,
    color: 'emerald'
  },
  {
    id: 'test_10',
    name: 'Plan Test Pro',
    badge: 'Prueba SINPE ₡10',
    priceUsd: 0.02,
    originalPriceUsd: 18,
    priceCrc: 10,
    interval: 'pago de prueba',
    bookingLimit: 100,
    bookingLimitLabel: '100 reservas de prueba',
    staffLimit: 5,
    staffLimitLabel: 'Hasta 5 especialistas',
    tagline: 'Plan de prueba profesional con todas las funciones activas y pago de ₡10 colones.',
    features: [
      'Monto de prueba simbólico de ₡10 colones',
      'Validación de comprobante en vivo y Webhook',
      'Todas las funciones del Plan Profesional activadas',
      'Gestión de equipo y especialistas múltiples',
      'Exportación de reportes a Excel y PDF'
    ],
    popular: true,
    color: 'cyan'
  }
];

export const INITIAL_CATEGORIES = [
  { id: 'all', name: 'Todas las Categorías', icon: 'fa-store' },
  { id: 'belleza', name: 'Belleza y Barbería', icon: 'fa-scissors' },
  { id: 'salud', name: 'Salud y Medicina', icon: 'fa-user-md' },
  { id: 'dental', name: 'Odontología y Dental', icon: 'fa-tooth' },
  { id: 'spa', name: 'Spa, Masajes y Estética', icon: 'fa-spa' },
  { id: 'fitness', name: 'Fitness y Deporte', icon: 'fa-dumbbell' },
  { id: 'mascotas', name: 'Veterinaria y Mascotas', icon: 'fa-paw' },
  { id: 'autos', name: 'Talleres y Automotriz', icon: 'fa-car' },
  { id: 'gastronomia', name: 'Restaurantes y Gastronomía', icon: 'fa-utensils' },
  { id: 'fotografia', name: 'Fotografía y Eventos', icon: 'fa-camera' },
  { id: 'educacion', name: 'Educación, Cursos y Tutorías', icon: 'fa-graduation-cap' },
  { id: 'profesionales', name: 'Servicios Legales y Contabilidad', icon: 'fa-balance-scale' },
  { id: 'hogar', name: 'Hogar, Reparaciones y Limpieza', icon: 'fa-tools' },
  { id: 'psicologia', name: 'Psicología y Terapia', icon: 'fa-brain' },
  { id: 'tatuajes', name: 'Tatuajes y Piercing', icon: 'fa-palette' },
  { id: 'tecnologia', name: 'Tecnología y Soporte', icon: 'fa-laptop-code' },
  { id: 'otros', name: 'Otros Servicios', icon: 'fa-concierge-bell' }
];

export const COSTA_RICA_PROVINCES = [
  {
    id: 'san_jose',
    name: 'San José',
    cantons: [
      'San José', 'Escazú', 'Desamparados', 'Puriscal', 'Tarrazú', 'Aserrí', 'Mora', 
      'Goicoechea', 'Santa Ana', 'Alajuelita', 'Vázquez de Coronado', 'Acosta', 
      'Tibás', 'Moravia', 'Montes de Oca', 'Turrubares', 'Dota', 'Curridabat', 
      'Pérez Zeledón', 'León Cortés'
    ]
  },
  {
    id: 'alajuela',
    name: 'Alajuela',
    cantons: [
      'Alajuela', 'San Ramón', 'Grecia', 'San Mateo', 'Atenas', 'Naranjo', 'Palmares', 
      'Poás', 'Orotina', 'San Carlos', 'Zarcero', 'Sarchí', 'Upala', 'Los Chiles', 
      'Guatuso', 'Río Cuarto'
    ]
  },
  {
    id: 'cartago',
    name: 'Cartago',
    cantons: [
      'Cartago', 'Paraíso', 'La Unión', 'Jiménez', 'Turrialba', 'Alvarado', 
      'Oreamuno', 'El Guarco'
    ]
  },
  {
    id: 'heredia',
    name: 'Heredia',
    cantons: [
      'Heredia', 'Barva', 'Santo Domingo', 'Santa Bárbara', 'San Rafael', 
      'San Isidro', 'Belén', 'Flores', 'San Pablo', 'Sarapiquí'
    ]
  },
  {
    id: 'guanacaste',
    name: 'Guanacaste',
    cantons: [
      'Liberia', 'Nicoya', 'Santa Cruz', 'Bagaces', 'Carrillo', 'Cañas', 
      'Abangares', 'Tilarán', 'Nandayure', 'La Cruz', 'Hojancha'
    ]
  },
  {
    id: 'puntarenas',
    name: 'Puntarenas',
    cantons: [
      'Puntarenas', 'Esparza', 'Buenos Aires', 'Montes de Oro', 'Osa', 'Quepos', 
      'Golfito', 'Coto Brus', 'Parrita', 'Corredores', 'Garabito', 'Monteverde', 
      'Puerto Jiménez'
    ]
  },
  {
    id: 'limon',
    name: 'Limón',
    cantons: [
      'Limón', 'Pococí', 'Siquirres', 'Talamanca', 'Matina', 'Guácimo'
    ]
  }
];

export const INITIAL_BUSINESSES = [
  // ==========================================
  // 1. BELLEZA Y BARBERÍA
  // ==========================================
  {
    id: 'biz-1',
    name: 'Barbería & Estilo Vintage',
    slug: 'barberia-estilo-vintage',
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
        portfolio: [
      {
            "id": "p1-1",
            "url": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80",
            "title": "Corte de Cabello Clásico y Degradado Fade"
      },
      {
            "id": "p1-2",
            "url": "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=800&q=80",
            "title": "Afeitado Tradicional con Toalla Caliente"
      },
      {
            "id": "p1-3",
            "url": "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=80",
            "title": "Perfilado y Arreglo de Barba"
      },
      {
            "id": "p1-4",
            "url": "https://images.unsplash.com/photo-1512690459411-b9245aed614b?auto=format&fit=crop&w=800&q=80",
            "title": "Sillones Clásicos y Ambiente Vintage"
      },
      {
            "id": "p1-5",
            "url": "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80",
            "title": "Corte Pompadour Moderno"
      },
      {
            "id": "p1-6",
            "url": "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=80",
            "title": "Pomadas y Cuidado de Barba"
      }
],
    services: [
      { id: 'srv-101', name: 'Corte de Cabello Clásico', duration: 30, price: 7000, description: 'Corte personalizado, lavado y peinado con cera mate.' },
      { id: 'srv-102', name: 'Arreglo y Perfilado de Barba', duration: 30, price: 5000, description: 'Toalla caliente, aceites esenciales, afeitado a navaja y bálsamo.' },
      { id: 'srv-103', name: 'Combo Premium (Corte + Barba)', duration: 60, price: 11000, description: 'La experiencia completa: corte, barba, exfoliación y masaje capilar.' },
      { id: 'srv-104', name: 'Tinte de Barba o Canas', duration: 45, price: 8000, description: 'Cobertura natural de canas con productos sin amoníaco.' }
    ]
  },
  {
    id: 'biz-2',
    name: 'Studio GLAM Salón & Nails Lounge',
    slug: 'studio-glam-salon-nails-lounge',
    category: 'belleza',
    categoryLabel: 'Belleza y Barbería',
    rating: 4.8,
    reviewsCount: 95,
    priceRange: '₡₡₡',
    address: 'Mall San Pedro, 2do Nivel',
    city: 'San José, San Pedro',
    phone: '+506 8344 1122',
    email: 'citas@studioglam.cr',
    description: 'Salón de belleza integral: manicura rusa, uñas acrílicas, balayage, keratinas y peinados para eventos especiales.',
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Sinpe Móvil', 'Tarjetas de Crédito', 'Bebidas de Cortesía', 'Ambiente Climatizado'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '09:00',
      closeTime: '19:00',
      breakStart: '13:00',
      breakEnd: '14:00',
      slotDuration: 30
    },
        portfolio: [
      {
            "id": "p2-1",
            "url": "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=80",
            "title": "Uñas Acrílicas y Nail Art de Tendencia"
      },
      {
            "id": "p2-2",
            "url": "https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=800&q=80",
            "title": "Balayage Rubios y Morenas Iluminadas"
      },
      {
            "id": "p2-3",
            "url": "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
            "title": "Peinados y Ondas para Eventos"
      },
      {
            "id": "p2-4",
            "url": "https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=800&q=80",
            "title": "Manicure Semipermanente Ruso"
      },
      {
            "id": "p2-5",
            "url": "https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=800&q=80",
            "title": "Corte Bob y Cepillado Glamour"
      },
      {
            "id": "p2-6",
            "url": "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=800&q=80",
            "title": "Extensiones de Pestañas y Cejas"
      }
],
    services: [
      { id: 'srv-201', name: 'Manicura Rusa & Gel Semipermanente', duration: 60, price: 16000, description: 'Limpieza profunda de cutícula, nivelación y esmaltado de alta duración.' },
      { id: 'srv-202', name: 'Pedicura Spa Hidratante', duration: 60, price: 18000, description: 'Exfoliación con sales minerales, mascarilla y masaje relajante de pies.' },
      { id: 'srv-203', name: 'Tratamiento de Keratina Brasileña', duration: 120, price: 45000, description: 'Alisado e hidratación profunda con brillo espejo.' }
    ]
  },

  // ==========================================
  // 2. SALUD Y MEDICINA
  // ==========================================
  {
    id: 'biz-3',
    name: 'Centro Médico Familiar del Este',
    slug: 'centro-medico-familiar-del-este',
    category: 'salud',
    categoryLabel: 'Salud y Medicina',
    rating: 4.9,
    reviewsCount: 140,
    priceRange: '₡₡₡',
    address: 'Plaza Momentum Pinares, Consultorio 301',
    city: 'San José, Curridabat',
    phone: '+506 2271 8899',
    email: 'info@medicodeleste.cr',
    description: 'Consultas médicas generales y especializadas, medicina preventiva, chequeos ejecutivos y electrocardiogramas.',
    image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1504813184591-01572f98c85f?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Médicos Certificados', 'Parqueo Techado', 'Laboratorio Clínico', 'Factura Electrónica'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '08:00',
      closeTime: '18:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      slotDuration: 30
    },
        portfolio: [
      {
            "id": "p3-1",
            "url": "https://images.unsplash.com/photo-1629909615184-74f495363b67?auto=format&fit=crop&w=800&q=80",
            "title": "Consultorio Médico Equipado"
      },
      {
            "id": "p3-2",
            "url": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=80",
            "title": "Consulta de Medicina General Preventiva"
      },
      {
            "id": "p3-3",
            "url": "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80",
            "title": "Toma de Signos Vitales y Control de Presión"
      },
      {
            "id": "p3-4",
            "url": "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80",
            "title": "Área de Curaciones y Primeros Auxilios"
      },
      {
            "id": "p3-5",
            "url": "https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?auto=format&fit=crop&w=800&q=80",
            "title": "Control y Chequeo Pediátrico Infantil"
      },
      {
            "id": "p3-6",
            "url": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80",
            "title": "Recepción y Sala de Espera Familiar"
      }
],
    services: [
      { id: 'srv-301', name: 'Consulta Médica General', duration: 30, price: 25000, description: 'Evaluación integral, toma de signos y receta médica digital.' },
      { id: 'srv-302', name: 'Chequeo Preventivo Integral', duration: 45, price: 40000, description: 'Incluye electrocardiograma básico, glucosa capilar y perfil de salud.' },
      { id: 'srv-303', name: 'Certificado Médico Oficial', duration: 20, price: 15000, description: 'Dictamen para licencia o requisitos laborales.' }
    ]
  },
  {
    id: 'biz-4',
    name: 'Clínica Médica Santa Ana & Especialistas',
    slug: 'clinica-medica-santa-ana-especialistas',
    category: 'salud',
    categoryLabel: 'Salud y Medicina',
    rating: 4.8,
    reviewsCount: 88,
    priceRange: '₡₡₡',
    address: 'City Place Santa Ana, Torre Médica A',
    city: 'San José, Santa Ana',
    phone: '+506 2282 4400',
    email: 'citas@medicasantaana.cr',
    description: 'Atención médica integral para toda la familia con pediatría, ginecología y medicina interna.',
    image: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Convenios Médicos', 'Farmacia en el Local', 'Atención Bilingüe', 'Sinpe Móvil'],
    schedule: {
      days: [1, 2, 3, 4, 5],
      openTime: '08:00',
      closeTime: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      slotDuration: 30
    },
        portfolio: [
      {
            "id": "p4-1",
            "url": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80",
            "title": "Instalaciones de Alta Especialidad"
      },
      {
            "id": "p4-2",
            "url": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=800&q=80",
            "title": "Consultorio de Medicina Interna"
      },
      {
            "id": "p4-3",
            "url": "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80",
            "title": "Equipo de Diagnóstico Digital"
      },
      {
            "id": "p4-4",
            "url": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80",
            "title": "Toma de Muestras y Laboratorio Clínico"
      },
      {
            "id": "p4-5",
            "url": "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=800&q=80",
            "title": "Evaluación Cardíaca y Electrocardiograma"
      },
      {
            "id": "p4-6",
            "url": "https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=800&q=80",
            "title": "Acceso Universal y Parqueo Médico"
      }
],
    services: [
      { id: 'srv-401', name: 'Consulta Medicina Interna', duration: 40, price: 35000, description: 'Diagnóstico y control de hipertensión, diabetes y salud general.' },
      { id: 'srv-402', name: 'Control Pediátrico del Niño Sano', duration: 30, price: 30000, description: 'Monitoreo de crecimiento, vacunas y desarrollo infantil.' }
    ]
  },

  // ==========================================
  // 3. ODONTOLOGÍA Y DENTAL
  // ==========================================
  {
    id: 'biz-5',
    name: 'Clínica Dental Sonrisas & Salud',
    slug: 'clinica-dental-sonrisas-salud',
    category: 'dental',
    categoryLabel: 'Odontología y Dental',
    rating: 4.8,
    reviewsCount: 94,
    priceRange: '₡₡₡',
    address: 'Frente a Paseo de las Flores, Consultorio 204',
    city: 'Heredia',
    phone: '+506 2260 1234',
    email: 'citas@dentalsonrisas.cr',
    description: 'Cuidado dental integral de alta tecnología. Limpiezas ultrasónicas, blanqueamiento LED, ortodoncia y odontopediatría.',
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
      slotDuration: 30
    },
        portfolio: [
      {
            "id": "p5-1",
            "url": "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=800&q=80",
            "title": "Consultorio Odontológico de Vanguardia"
      },
      {
            "id": "p5-2",
            "url": "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=800&q=80",
            "title": "Limpieza Dental Ultrasonido y Profilaxis"
      },
      {
            "id": "p5-3",
            "url": "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=800&q=80",
            "title": "Instrumental Esterilizado y Cámara Intraoral"
      },
      {
            "id": "p5-4",
            "url": "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80",
            "title": "Blanqueamiento Dental en Consulta"
      },
      {
            "id": "p5-5",
            "url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
            "title": "Resultados de Sonrisa Sana y Brillante"
      },
      {
            "id": "p5-6",
            "url": "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80",
            "title": "Atención Infantil Amigable y sin Dolor"
      }
],
    services: [
      { id: 'srv-501', name: 'Valoración y Diagnóstico Dental', duration: 30, price: 15000, description: 'Revisión completa con cámara intraoral y presupuesto detallado.' },
      { id: 'srv-502', name: 'Limpieza Dental con Ultrasonido', duration: 45, price: 25000, description: 'Eliminación profunda de sarro, profilaxis y aplicación de flúor.' },
      { id: 'srv-503', name: 'Blanqueamiento Dental LED', duration: 60, price: 75000, description: 'Sesión intensiva para aclarar hasta 4 tonos en una sola visita.' },
      { id: 'srv-504', name: 'Consulta de Ortodoncia / Brackets', duration: 45, price: 20000, description: 'Evaluación personalizada para alineación e invisalign.' }
    ]
  },
  {
    id: 'biz-6',
    name: 'Dental Art Costa Rica - Odontología Estética',
    slug: 'dental-art-costa-rica-odontologia-estetica',
    category: 'dental',
    categoryLabel: 'Odontología y Dental',
    rating: 5.0,
    reviewsCount: 112,
    priceRange: '₡₡₡₡',
    address: 'Rohrmoser, 200m Norte de Plaza Mayor',
    city: 'San José, Rohrmoser',
    phone: '+506 2296 9000',
    email: 'info@dentalart.cr',
    description: 'Especialistas en diseño de sonrisa, carillas de porcelana, implantes dentales y rehabilitación oral sin dolor.',
    image: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Odontología Digital', 'Scanner 3D', 'Financiamiento Disponible', 'Café Gourmet'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '09:00',
      closeTime: '18:00',
      breakStart: '13:00',
      breakEnd: '14:00',
      slotDuration: 30
    },
        portfolio: [
      {
            "id": "p6-1",
            "url": "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80",
            "title": "Clínica de Estética Dental & Escáner 3D"
      },
      {
            "id": "p6-2",
            "url": "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=800&q=80",
            "title": "Diseño de Sonrisa Digital (DSD)"
      },
      {
            "id": "p6-3",
            "url": "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=800&q=80",
            "title": "Colocación de Carillas de Porcelana"
      },
      {
            "id": "p6-4",
            "url": "https://images.unsplash.com/photo-1598256989800-fe5f95da9787?auto=format&fit=crop&w=800&q=80",
            "title": "Tecnología Láser para Rehabilitación Oral"
      },
      {
            "id": "p6-5",
            "url": "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80",
            "title": "Sonrisa Perfecta Antes y Después"
      },
      {
            "id": "p6-6",
            "url": "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80",
            "title": "Cubículo Odontológico VIP con Luz Natural"
      }
],
    services: [
      { id: 'srv-601', name: 'Diseño de Sonrisa Digital (DSD)', duration: 60, price: 45000, description: 'Estudio fotográfico y simulación digital 3D de tu nueva sonrisa.' },
      { id: 'srv-602', name: 'Restauración Estética de Resina', duration: 45, price: 28000, description: 'Calza estética del color natural de tu diente.' }
    ]
  },

  // ==========================================
  // 4. SPA, MASAJES Y ESTÉTICA
  // ==========================================
  {
    id: 'biz-7',
    name: 'Serenity Spa & Masajes Holísticos',
    slug: 'serenity-spa-masajes-holisticos',
    category: 'spa',
    categoryLabel: 'Spa, Masajes y Estética',
    rating: 5.0,
    reviewsCount: 210,
    priceRange: '₡₡₡',
    address: 'Barrio Escalante, 100m Este del Parque Francia',
    city: 'San José',
    phone: '+506 7143 3852',
    email: 'relax@serenityspa.cr',
    description: 'Un oasis de relajación en la ciudad. Tratamientos corporales, masajes relajantes y descontracturantes con piedras volcánicas y aromaterapia.',
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
      slotDuration: 30
    },
        portfolio: [
      {
            "id": "p7-1",
            "url": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
            "title": "Cabina de Masajes con Aromaterapia"
      },
      {
            "id": "p7-2",
            "url": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80",
            "title": "Masaje Relajante con Piedras Calientes"
      },
      {
            "id": "p7-3",
            "url": "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=800&q=80",
            "title": "Masaje Descontracturante Profundo"
      },
      {
            "id": "p7-4",
            "url": "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80",
            "title": "Limpieza Facial Profunda e Hidratación"
      },
      {
            "id": "p7-5",
            "url": "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=800&q=80",
            "title": "Tina de Hidromasaje y Relajación"
      },
      {
            "id": "p7-6",
            "url": "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=800&q=80",
            "title": "Té Herbal de Bienvenida y Zona Zen"
      }
],
    services: [
      { id: 'srv-701', name: 'Masaje Relajante con Aromaterapia', duration: 60, price: 22000, description: 'Masaje suave con aceites de lavanda para liberar el estrés y tensión.' },
      { id: 'srv-702', name: 'Masaje Descontracturante Profundo', duration: 60, price: 26000, description: 'Técnica focalizada en nudos musculares en espalda, cuello y hombros.' },
      { id: 'srv-703', name: 'Terapia con Piedras Volcánicas Calientes', duration: 75, price: 32000, description: 'Piedras a temperatura ideal para calmar el sistema nervioso.' },
      { id: 'srv-704', name: 'Facial Hidratante y Rejuvenecedor', duration: 45, price: 20000, description: 'Limpieza profunda, mascarilla de colágeno y serum de ácido hialurónico.' }
    ]
  },
  {
    id: 'biz-8',
    name: 'Aura Zen Spa & Terapias Termales',
    slug: 'aura-zen-spa-terapias-termales',
    category: 'spa',
    categoryLabel: 'Spa, Masajes y Estética',
    rating: 4.9,
    reviewsCount: 135,
    priceRange: '₡₡₡',
    address: 'La Fortuna, 500m Sur del Parque Central',
    city: 'Alajuela, San Carlos',
    phone: '+506 2479 1199',
    email: 'reservas@aurazenspa.cr',
    description: 'Experiencia termal y relajación con barros volcánicos, hidroterapia y masajes en medio de la naturaleza.',
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Piscinas Termales', 'Barro Volcánico', 'Duchas al Aire Libre', 'Sinpe Móvil'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6, 0],
      openTime: '09:00',
      closeTime: '21:00',
      breakStart: '13:00',
      breakEnd: '14:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p8-1",
            "url": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
            "title": "Sauna Nórdico de Madera de Cedro"
      },
      {
            "id": "p8-2",
            "url": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=800&q=80",
            "title": "Terapia Termal de Sales Minerales"
      },
      {
            "id": "p8-3",
            "url": "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?auto=format&fit=crop&w=800&q=80",
            "title": "Masaje Sueco y Reflexología Podal"
      },
      {
            "id": "p8-4",
            "url": "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=800&q=80",
            "title": "Circuito de Hidroterapia y Jacuzzi"
      },
      {
            "id": "p8-5",
            "url": "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=800&q=80",
            "title": "Envoltura Corporal en Barro Volcánico"
      },
      {
            "id": "p8-6",
            "url": "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=800&q=80",
            "title": "Lounge de Meditación y Camillas Térmicas"
      }
],
    services: [
      { id: 'srv-801', name: 'Envoltura de Fango Volcánico', duration: 60, price: 30000, description: 'Exfoliación mineral y envoltura corporal desintoxicante.' },
      { id: 'srv-802', name: 'Circuito Spa Dúo (Para Parejas)', duration: 90, price: 55000, description: 'Masaje relajante en cabina doble con sesión de hidromasaje.' }
    ]
  },

  // ==========================================
  // 5. FITNESS Y DEPORTE
  // ==========================================
  {
    id: 'biz-9',
    name: 'Titan Gym & Cross Training Costa Rica',
    slug: 'titan-gym-cross-training-costa-rica',
    category: 'fitness',
    categoryLabel: 'Fitness y Deporte',
    rating: 4.8,
    reviewsCount: 160,
    priceRange: '₡₡',
    address: 'Cartago Centro, 200m Sur de la Basílica',
    city: 'Cartago',
    phone: '+506 2551 9090',
    email: 'info@titangym.cr',
    description: 'Gimnasio de alto rendimiento con zona de pesas, entrenamiento funcional, cross training y asesoría nutricional.',
    image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Entrenadores Certificados', 'Duchas y Lockers', 'Batidos Proteicos', 'Parqueo Seguro'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '05:30',
      closeTime: '21:30',
      breakStart: '12:00',
      breakEnd: '13:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p9-1",
            "url": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80",
            "title": "Zona de Mancuernas y Pesas Libres"
      },
      {
            "id": "p9-2",
            "url": "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80",
            "title": "Box de Cross Training y Barras Olímpicas"
      },
      {
            "id": "p9-3",
            "url": "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80",
            "title": "Máquinas de Fuerza y Poleas de Alta Gama"
      },
      {
            "id": "p9-4",
            "url": "https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=800&q=80",
            "title": "Área Cardiovascular y Trotadoras"
      },
      {
            "id": "p9-5",
            "url": "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=800&q=80",
            "title": "Pista de Trineo y Entrenamiento Funcional"
      },
      {
            "id": "p9-6",
            "url": "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=800&q=80",
            "title": "Coaching y Entrenamiento Personalizado"
      }
],
    services: [
      { id: 'srv-901', name: 'Sesión de Entrenamiento Personalizado', duration: 60, price: 12000, description: 'Rutina individual guiada por entrenador profesional según tus metas.' },
      { id: 'srv-902', name: 'Evaluación Física & Plan Nutricional', duration: 45, price: 18000, description: 'Medición de grasa corporal InBody y cálculo de macronutrientes.' }
    ]
  },
  {
    id: 'biz-10',
    name: 'Equilibrio Yoga & Pilates Studio',
    slug: 'equilibrio-yoga-pilates-studio',
    category: 'fitness',
    categoryLabel: 'Fitness y Deporte',
    rating: 5.0,
    reviewsCount: 78,
    priceRange: '₡₡₡',
    address: 'San Rafael de Escazú, Plaza Florencia',
    city: 'San José, Escazú',
    phone: '+506 8833 4455',
    email: 'namaste@equilibrioyoga.cr',
    description: 'Estudio boutique especializado en Hatha Yoga, Vinyasa Flow, Pilates Reformer y meditación guiada.',
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Mats y Accesorios Incluidos', 'Grupos Reducidos', 'Ambiente Zen', 'Sinpe Móvil'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '07:00',
      closeTime: '19:00',
      breakStart: '12:00',
      breakEnd: '14:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p10-1",
            "url": "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80",
            "title": "Estudio Luminoso de Yoga y Pilates"
      },
      {
            "id": "p10-2",
            "url": "https://images.unsplash.com/photo-1599447421416-3414500d18a5?auto=format&fit=crop&w=800&q=80",
            "title": "Camas Reformer de Pilates Profesionales"
      },
      {
            "id": "p10-3",
            "url": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80",
            "title": "Clase de Vinyasa Flow y Flexibilidad"
      },
      {
            "id": "p10-4",
            "url": "https://images.unsplash.com/photo-1545205597-3d9d02c29597?auto=format&fit=crop&w=800&q=80",
            "title": "Props, Bolsters y Bloques de Yoga"
      },
      {
            "id": "p10-5",
            "url": "https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?auto=format&fit=crop&w=800&q=80",
            "title": "Meditación Guiada y Respiración Consciente"
      },
      {
            "id": "p10-6",
            "url": "https://images.unsplash.com/photo-1552196563-552443422b8a?auto=format&fit=crop&w=800&q=80",
            "title": "Entrenamiento Postural Personalizado"
      }
],
    services: [
      { id: 'srv-1001', name: 'Clase Privada de Pilates Reformer', duration: 60, price: 20000, description: 'Sesión con máquina Reformer para fortalecer postura y core.' },
      { id: 'srv-1002', name: 'Sesión de Yoga y Meditación Sonora', duration: 60, price: 15000, description: 'Posturas suaves y relajación con cuencos tibetanos.' }
    ]
  },

  // ==========================================
  // 6. VETERINARIA Y MASCOTAS
  // ==========================================
  {
    id: 'biz-11',
    name: 'Hospital Veterinario San Francisco',
    slug: 'hospital-veterinario-san-francisco',
    category: 'mascotas',
    categoryLabel: 'Veterinaria y Mascotas',
    rating: 4.9,
    reviewsCount: 185,
    priceRange: '₡₡₡',
    address: 'Moravia Centro, 300m Norte del Parque',
    city: 'San José, Moravia',
    phone: '+506 2240 5566',
    email: 'contacto@vetsanfrancisco.cr',
    description: 'Atención médica veterinaria para perros y gatos. Vacunación, cirugías, laboratorio, rayos X y hospitalización 24 horas.',
    image: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Emergencias 24/7', 'Farmacia Veterinaria', 'Sinpe Móvil', 'Parqueo Propio'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6, 0],
      openTime: '08:00',
      closeTime: '20:00',
      breakStart: '12:30',
      breakEnd: '13:30',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p11-1",
            "url": "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=800&q=80",
            "title": "Consultorio Veterinario Moderno"
      },
      {
            "id": "p11-2",
            "url": "https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?auto=format&fit=crop&w=800&q=80",
            "title": "Chequeo Preventivo y Vacunación Canina"
      },
      {
            "id": "p11-3",
            "url": "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?auto=format&fit=crop&w=800&q=80",
            "title": "Atención Clínica y Ecografía Veterinaria"
      },
      {
            "id": "p11-4",
            "url": "https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80",
            "title": "Cuidado Especializado de Mascotas"
      },
      {
            "id": "p11-5",
            "url": "https://images.unsplash.com/photo-1606425271394-c3ca9aa1fc06?auto=format&fit=crop&w=800&q=80",
            "title": "Área de Hospitalización y Monitoreo"
      },
      {
            "id": "p11-6",
            "url": "https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?auto=format&fit=crop&w=800&q=80",
            "title": "Pacientes Felices y Recuperados"
      }
],
    services: [
      { id: 'srv-1101', name: 'Consulta Médica Veterinaria', duration: 30, price: 18000, description: 'Chequeo clínico general, revisión de peso, ojos, oídos y signos vitales.' },
      { id: 'srv-1102', name: 'Vacunación Múltiple & Desparasitación', duration: 20, price: 16000, description: 'Aplicación de vacuna séxtuple o antirrábica con carnet oficial.' },
      { id: 'srv-1103', name: 'Limpieza Dental Canina con Ultrasonido', duration: 60, price: 45000, description: 'Profilaxis dental bajo sedación controlada y pulido.' }
    ]
  },
  {
    id: 'biz-12',
    name: 'PetCare Grooming & Spa de Mascotas',
    slug: 'petcare-grooming-spa-de-mascotas',
    category: 'mascotas',
    categoryLabel: 'Veterinaria y Mascotas',
    rating: 4.8,
    reviewsCount: 110,
    priceRange: '₡₡',
    address: 'San Joaquín de Flores, 150m Oeste de la Iglesia',
    city: 'Heredia',
    phone: '+506 8912 3456',
    email: 'citas@petcarespa.cr',
    description: 'Estética canina y felina con cariño y paciencia. Baños medicinales, cortes de raza, corte de uñas y aromaterapia.',
    image: 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Champú Hipoalergénico', 'Transporte Pet Taxi', 'Sinpe Móvil', 'Sin Jaulas'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '08:30',
      closeTime: '17:30',
      breakStart: '12:00',
      breakEnd: '13:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p12-1",
            "url": "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=800&q=80",
            "title": "Baño con Shampoo Hipoalergénico y Masaje"
      },
      {
            "id": "p12-2",
            "url": "https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=800&q=80",
            "title": "Corte de Pelo a Tijera para Razas"
      },
      {
            "id": "p12-3",
            "url": "https://images.unsplash.com/photo-1535930891776-0c2dfb7fda1a?auto=format&fit=crop&w=800&q=80",
            "title": "Cepillado y Deslanado Profesional"
      },
      {
            "id": "p12-4",
            "url": "https://images.unsplash.com/photo-1587300003388-59208cc962cb?auto=format&fit=crop&w=800&q=80",
            "title": "Limpieza de Oídos y Corte de Uñas"
      },
      {
            "id": "p12-5",
            "url": "https://images.unsplash.com/photo-1544568100-847a948585b9?auto=format&fit=crop&w=800&q=80",
            "title": "Perros Consentidos con Lazos y Perfume"
      },
      {
            "id": "p12-6",
            "url": "https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=800&q=80",
            "title": "Instalaciones Climatizadas sin Jaulas"
      }
],
    services: [
      { id: 'srv-1201', name: 'Baño Spa Completo (Raza Pequeña / Mediana)', duration: 60, price: 14000, description: 'Baño con champú de avena, secado, cepillado, corte de uñas y perfume.' },
      { id: 'srv-1202', name: 'Grooming & Corte de Raza Completo', duration: 75, price: 20000, description: 'Corte según estándar de la raza, limpieza de oídos y glándulas.' }
    ]
  },

  // ==========================================
  // 7. TALLERES Y AUTOMOTRIZ
  // ==========================================
  {
    id: 'biz-13',
    name: 'AutoCheck Taller Mecánico Especializado',
    slug: 'autocheck-taller-mecanico-especializado',
    category: 'autos',
    categoryLabel: 'Talleres y Automotriz',
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
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p13-1",
            "url": "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=800&q=80",
            "title": "Elevadores Hidráulicos y Bahías de Trabajo"
      },
      {
            "id": "p13-2",
            "url": "https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80",
            "title": "Diagnóstico Computarizado con Escáner"
      },
      {
            "id": "p13-3",
            "url": "https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80",
            "title": "Mantenimiento y Reemplazo de Frenos"
      },
      {
            "id": "p13-4",
            "url": "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=800&q=80",
            "title": "Afinamiento de Motor y Cambio de Aceite"
      },
      {
            "id": "p13-5",
            "url": "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80",
            "title": "Alineación y Balanceo Láser 3D"
      },
      {
            "id": "p13-6",
            "url": "https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?auto=format&fit=crop&w=800&q=80",
            "title": "Mecánicos Calificados y Trabajo Garantizado"
      }
],
    services: [
      { id: 'srv-1301', name: 'Diagnóstico por Escáner Computarizado', duration: 30, price: 15000, description: 'Lectura de códigos de falla OBD2 y revisión de sensores.' },
      { id: 'srv-1302', name: 'Afinación Menor (Aceite Sintético + Filtros)', duration: 60, price: 42000, description: 'Cambio de aceite 100% sintético, filtro de aceite y filtro de aire.' },
      { id: 'srv-1303', name: 'Servicio de Frenos Completo', duration: 90, price: 55000, description: 'Rectificado de discos, cambio de pastillas y purgado de líquido.' }
    ]
  },
  {
    id: 'biz-14',
    name: 'ElectroAuto & Detailing Pro CR',
    slug: 'electroauto-detailing-pro-cr',
    category: 'autos',
    categoryLabel: 'Talleres y Automotriz',
    rating: 4.9,
    reviewsCount: 104,
    priceRange: '₡₡₡',
    address: 'Zapote, Frente a la Rotonda de las Garantías Sociales',
    city: 'San José, Zapote',
    phone: '+506 2225 3344',
    email: 'contacto@detailingpro.cr',
    description: 'Especialistas en electricidad automotriz, pulido cerámico, lavado profundo de tapicería y restauración de faros.',
    image: 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Productos Cerámicos Gyeon', 'Factura Electrónica', 'Sinpe Móvil', 'Seguridad 24/7'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '08:00',
      closeTime: '18:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p14-1",
            "url": "https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&w=800&q=80",
            "title": "Lavado Detallado y Enjuague a Presión"
      },
      {
            "id": "p14-2",
            "url": "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=800&q=80",
            "title": "Corrección de Pintura y Pulido Espejo"
      },
      {
            "id": "p14-3",
            "url": "https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=800&q=80",
            "title": "Aplicación de Recubrimiento Cerámico"
      },
      {
            "id": "p14-4",
            "url": "https://images.unsplash.com/photo-1507136566006-cfc505b114fc?auto=format&fit=crop&w=800&q=80",
            "title": "Limpieza Profunda de Interiores y Cuero"
      },
      {
            "id": "p14-5",
            "url": "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=800&q=80",
            "title": "Detallado de Aros y Llantas"
      },
      {
            "id": "p14-6",
            "url": "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=800&q=80",
            "title": "Acabado de Exhibición Showroom"
      }
],
    services: [
      { id: 'srv-1401', name: 'Lavado y Desinfección de Tapicería', duration: 120, price: 35000, description: 'Inyección-extracción profunda en asientos, alfombras y cielo raso.' },
      { id: 'srv-1402', name: 'Pulido y Sellado Cerámico de Pintura', duration: 180, price: 85000, description: 'Corrección de rayones y protección cerámica hidrofóbica por 12 meses.' }
    ]
  },

  // ==========================================
  // 8. RESTAURANTES Y GASTRONOMÍA
  // ==========================================
  {
    id: 'biz-15',
    name: 'Restaurante El Mirador del Valle',
    slug: 'restaurante-el-mirador-del-valle',
    category: 'gastronomia',
    categoryLabel: 'Restaurantes y Gastronomía',
    rating: 4.9,
    reviewsCount: 320,
    priceRange: '₡₡₡',
    address: 'Faldas del Volcán Poás, Km 14',
    city: 'Alajuela, Poás',
    phone: '+506 2482 1100',
    email: 'reservas@miradordelvalle.cr',
    description: 'Gastronomía costarricense e internacional con vista panorámica a todo el Valle Central. Cortes de carne, mariscos y café de especialidad.',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Vista Panorámica', 'Música en Vivo', 'Amplio Parqueo', 'Chimenea', 'Menú Infantil'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6, 0],
      openTime: '11:30',
      closeTime: '22:00',
      breakStart: '16:00',
      breakEnd: '17:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p15-1",
            "url": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
            "title": "Salón Principal con Vista Panorámica"
      },
      {
            "id": "p15-2",
            "url": "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
            "title": "Cortes de Carne Madurados a la Parrilla"
      },
      {
            "id": "p15-3",
            "url": "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
            "title": "Platillos Gourmet con Ingredientes Locales"
      },
      {
            "id": "p15-4",
            "url": "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80",
            "title": "Selección de Vinos y Maridaje"
      },
      {
            "id": "p15-5",
            "url": "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=800&q=80",
            "title": "Terraza Exterior para Atardeceres"
      },
      {
            "id": "p15-6",
            "url": "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80",
            "title": "Postres de Autor y Café de la Casa"
      }
],
    services: [
      { id: 'srv-1501', name: 'Reserva de Mesa con Vista Panorámica', duration: 60, price: 5000, description: 'Garantiza mesa en balcón principal (monto acreditable al consumo).' },
      { id: 'srv-1502', name: 'Cena Romántica de 3 Tiempos para Pareja', duration: 90, price: 48000, description: 'Entrada, dos platos fuertes a la carta, postre para compartir y copa de vino.' }
    ]
  },
  {
    id: 'biz-16',
    name: 'Café & Bistro La Esquina Tica',
    slug: 'cafe-bistro-la-esquina-tica',
    category: 'gastronomia',
    categoryLabel: 'Restaurantes y Gastronomía',
    rating: 4.8,
    reviewsCount: 145,
    priceRange: '₡₡',
    address: 'Barrio Amón, Calle 3, Av. 11',
    city: 'San José',
    phone: '+506 2221 7788',
    email: 'hola@laesquinatica.cr',
    description: 'Cafetería de especialidad con granos de Tarrazú y Naranjo, repostería artesanal, desayunos típicos y almuerzos ejecutivos.',
    image: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Pet Friendly', 'WiFi Alta Velocidad', 'Opciones Veganas', 'Sinpe Móvil'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '07:30',
      closeTime: '19:00',
      breakStart: '14:00',
      breakEnd: '15:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p16-1",
            "url": "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80",
            "title": "Barra de Café de Especialidad"
      },
      {
            "id": "p16-2",
            "url": "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80",
            "title": "Arte Latte en Tazas Artesanales"
      },
      {
            "id": "p16-3",
            "url": "https://images.unsplash.com/photo-1525610553991-2bede1a236e2?auto=format&fit=crop&w=800&q=80",
            "title": "Brunch con Pan de Masa Madre"
      },
      {
            "id": "p16-4",
            "url": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80",
            "title": "Repostería Recién Horneada del Día"
      },
      {
            "id": "p16-5",
            "url": "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80",
            "title": "Ambiente Cálido para Trabajar y Compartir"
      },
      {
            "id": "p16-6",
            "url": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80",
            "title": "Filtrados Chemex y V60 con Grano Tico"
      }
],
    services: [
      { id: 'srv-1601', name: 'Cata de Café de Especialidad (3 Regiones)', duration: 45, price: 12000, description: 'Degustación guiada de café filtrado en métodos V60, Chemex y Aeropress.' },
      { id: 'srv-1602', name: 'Brunch Completo de Fin de Semana', duration: 60, price: 10500, description: 'Tostadas francesas o gallo pinto gourmet, jugo natural y café ilimitado.' }
    ]
  },

  // ==========================================
  // 9. FOTOGRAFÍA Y EVENTOS
  // ==========================================
  {
    id: 'biz-17',
    name: 'Luz & Arte Fotografía de Bodas & Retratos',
    slug: 'luz-arte-fotografia-de-bodas-retratos',
    category: 'fotografia',
    categoryLabel: 'Fotografía y Eventos',
    rating: 5.0,
    reviewsCount: 92,
    priceRange: '₡₡₡',
    address: 'Santa Ana Centro, Condominio El Bosque',
    city: 'San José, Santa Ana',
    phone: '+506 8822 9900',
    email: 'contacto@luzartefoto.cr',
    description: 'Fotografía profesional emotiva para bodas, sesiones de maternidad, retratos ejecutivos y eventos familiares.',
    image: 'https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Entrega en Galería Online', 'Edición en Alta Resolución', 'Dron 4K', 'Sinpe Móvil'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6, 0],
      openTime: '08:00',
      closeTime: '18:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p17-1",
            "url": "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80",
            "title": "Sesión de Boda al Atardecer"
      },
      {
            "id": "p17-2",
            "url": "https://images.unsplash.com/photo-1583939003579-730e3918a45a?auto=format&fit=crop&w=800&q=80",
            "title": "Retratos Nupciales Emotivos"
      },
      {
            "id": "p17-3",
            "url": "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=800&q=80",
            "title": "Detalles Únicos de la Celebración"
      },
      {
            "id": "p17-4",
            "url": "https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&w=800&q=80",
            "title": "Sesión de Compromiso al Aire Libre"
      },
      {
            "id": "p17-5",
            "url": "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?auto=format&fit=crop&w=800&q=80",
            "title": "Fotografía Fine Art de Parejas"
      },
      {
            "id": "p17-6",
            "url": "https://images.unsplash.com/photo-1520854221256-17451cc331bf?auto=format&fit=crop&w=800&q=80",
            "title": "Momentos Inolvidables y Genuinos"
      }
],
    services: [
      { id: 'srv-1701', name: 'Sesión de Retrato en Exterior / Familiar', duration: 60, price: 45000, description: '1 hora en locación, 25 fotos editadas en alta resolución y galería privada.' },
      { id: 'srv-1702', name: 'Sesión Fotográfica de Maternidad o Pareja', duration: 75, price: 55000, description: 'Incluye cambio de vestuario, asesoría de poses y 35 fotos digitales.' }
    ]
  },
  {
    id: 'biz-18',
    name: 'Pixel Studio Producciones & Video',
    slug: 'pixel-studio-producciones-video',
    category: 'fotografia',
    categoryLabel: 'Fotografía y Eventos',
    rating: 4.8,
    reviewsCount: 64,
    priceRange: '₡₡₡',
    address: 'Montes de Oca, 100m Este de la Fuente de la Hispanidad',
    city: 'San José, San Pedro',
    phone: '+506 8700 1234',
    email: 'info@pixelstudiocr.com',
    description: 'Estudio fotográfico profesional para fotografía de producto, retratos corporativos para LinkedIn y video publicitario.',
    image: 'https://images.unsplash.com/photo-1520390138845-fd2d229dd553?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Estudio Climatizado', 'Fondos Infinitos', 'Iluminación Profoto', 'Factura Electrónica'],
    schedule: {
      days: [1, 2, 3, 4, 5],
      openTime: '09:00',
      closeTime: '18:00',
      breakStart: '13:00',
      breakEnd: '14:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p18-1",
            "url": "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=800&q=80",
            "title": "Set Fotográfico con Luces Profesionales"
      },
      {
            "id": "p18-2",
            "url": "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80",
            "title": "Sesión de Fotografía Publicitaria de Producto"
      },
      {
            "id": "p18-3",
            "url": "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=800&q=80",
            "title": "Retratos Corporativos y Ejecutivos"
      },
      {
            "id": "p18-4",
            "url": "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=800&q=80",
            "title": "Grabación de Video Comercial y Cine"
      },
      {
            "id": "p18-5",
            "url": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80",
            "title": "Estudio Insonorizado para Podcasts"
      },
      {
            "id": "p18-6",
            "url": "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?auto=format&fit=crop&w=800&q=80",
            "title": "Edición y Corrección de Color 4K"
      }
],
    services: [
      { id: 'srv-1801', name: 'Retrato Corporativo / Headshot LinkedIn', duration: 30, price: 25000, description: '3 fotos profesionales editadas listas para tu perfil ejecutivo o web.' },
      { id: 'srv-1802', name: 'Fotografía de Producto para E-Commerce', duration: 60, price: 50000, description: 'Hasta 10 productos con fondo blanco o estilo lifestyle.' }
    ]
  },

  // ==========================================
  // 10. EDUCACIÓN, CURSOS Y TUTORÍAS
  // ==========================================
  {
    id: 'biz-19',
    name: 'Academia de Idiomas & Tutorías Pura Vida',
    slug: 'academia-de-idiomas-tutorias-pura-vida',
    category: 'educacion',
    categoryLabel: 'Educación, Cursos y Tutorías',
    rating: 4.9,
    reviewsCount: 118,
    priceRange: '₡₡',
    address: 'Paseo Colón, Calle 28, Edificio Colón',
    city: 'San José',
    phone: '+506 2258 4040',
    email: 'info@idiomaspuravida.cr',
    description: 'Clases personalizadas de Inglés conversacional, Francés, Portugués y preparación para exámenes TOEIC / TOEFL.',
    image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Profesores Nativos', 'Modalidad Presencial y Virtual', 'Material Digital Incluido'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '08:00',
      closeTime: '20:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p19-1",
            "url": "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=800&q=80",
            "title": "Aulas Climatizadas con Pantallas Táctiles"
      },
      {
            "id": "p19-2",
            "url": "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=800&q=80",
            "title": "Clases Conversacionales en Grupos Pequeños"
      },
      {
            "id": "p19-3",
            "url": "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80",
            "title": "Tutorías Personalizadas One-on-One"
      },
      {
            "id": "p19-4",
            "url": "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=800&q=80",
            "title": "Preparación para Exámenes Internacionales"
      },
      {
            "id": "p19-5",
            "url": "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80",
            "title": "Metodología Dinámica y Participativa"
      },
      {
            "id": "p19-6",
            "url": "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=800&q=80",
            "title": "Plataforma Digital de Refuerzo"
      }
],
    services: [
      { id: 'srv-1901', name: 'Clase Individual de Inglés Conversacional (1 a 1)', duration: 60, price: 14000, description: 'Sesión intensiva enfocada en fluidez, vocabulario laboral y pronunciación.' },
      { id: 'srv-1902', name: 'Tutoría de Matemáticas y Física para Colegio', duration: 60, price: 12000, description: 'Refuerzo para exámenes de MEP, bachillerato o ingreso universitario.' }
    ]
  },
  {
    id: 'biz-20',
    name: 'Studio Musical & Clases de Instrumentos',
    slug: 'studio-musical-clases-de-instrumentos',
    category: 'educacion',
    categoryLabel: 'Educación, Cursos y Tutorías',
    rating: 4.9,
    reviewsCount: 73,
    priceRange: '₡₡',
    address: 'Heredia Centro, 100m Este de la UNA',
    city: 'Heredia',
    phone: '+506 8811 7766',
    email: 'contacto@studiomusical.cr',
    description: 'Aprende a tocar guitarra, piano, canto, batería y bajo con profesores graduados y metodología práctica y divertida.',
    image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Cabinas Insonorizadas', 'Instrumentos en Clase', 'Para Niños y Adultos', 'Sinpe Móvil'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '09:00',
      closeTime: '19:00',
      breakStart: '12:30',
      breakEnd: '13:30',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p20-1",
            "url": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80",
            "title": "Cabinas Insonorizadas de Ensayo"
      },
      {
            "id": "p20-2",
            "url": "https://images.unsplash.com/photo-1520523839898-507124cd5333?auto=format&fit=crop&w=800&q=80",
            "title": "Clases de Piano Clásico y Moderno"
      },
      {
            "id": "p20-3",
            "url": "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?auto=format&fit=crop&w=800&q=80",
            "title": "Técnica de Guitarra Acústica y Eléctrica"
      },
      {
            "id": "p20-4",
            "url": "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?auto=format&fit=crop&w=800&q=80",
            "title": "Set de Batería Acústica Completa"
      },
      {
            "id": "p20-5",
            "url": "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=800&q=80",
            "title": "Técnica Vocal y Canto con Micrófono Pro"
      },
      {
            "id": "p20-6",
            "url": "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80",
            "title": "Grabación y Monitoreo de Audio"
      }
],
    services: [
      { id: 'srv-2001', name: 'Clase Individual de Piano / Teclado', duration: 45, price: 15000, description: 'Técnica, lectura de partituras y repertorio a tu gusto.' },
      { id: 'srv-2002', name: 'Clase de Canto y Técnica Vocal', duration: 45, price: 16000, description: 'Respiración diafragmática, afinación, colocación y proyección vocal.' }
    ]
  },

  // ==========================================
  // 11. SERVICIOS LEGALES Y CONTABILIDAD
  // ==========================================
  {
    id: 'biz-21',
    name: 'Bufete Jurídico Central & Notaría',
    slug: 'bufete-juridico-central-notaria',
    category: 'profesionales',
    categoryLabel: 'Servicios Legales y Contabilidad',
    rating: 4.9,
    reviewsCount: 80,
    priceRange: '₡₡₡',
    address: 'Paseo Colón, Torre Mercedes, Piso 7',
    city: 'San José',
    phone: '+506 2257 6000',
    email: 'consultas@bufetecentral.cr',
    description: 'Asesoría legal corporativa, derecho laboral, constitución de sociedades mercantiles, traspaso de vehículos y escrituras notariales.',
    image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Abogados Colegiados', 'Factura Electrónica', 'Consultas Confidenciales', 'Parqueo'],
    schedule: {
      days: [1, 2, 3, 4, 5],
      openTime: '08:30',
      closeTime: '17:30',
      breakStart: '12:00',
      breakEnd: '13:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p21-1",
            "url": "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
            "title": "Sala de Reuniones y Firmas Notariales"
      },
      {
            "id": "p21-2",
            "url": "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80",
            "title": "Biblioteca Jurídica y Estudio de Casos"
      },
      {
            "id": "p21-3",
            "url": "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80",
            "title": "Asesoría Legal y Corporativa"
      },
      {
            "id": "p21-4",
            "url": "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=800&q=80",
            "title": "Firma de Escrituras y Contratos"
      },
      {
            "id": "p21-5",
            "url": "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80",
            "title": "Abogados Asociados Especialistas"
      },
      {
            "id": "p21-6",
            "url": "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
            "title": "Oficinas Centrales en San José"
      }
],
    services: [
      { id: 'srv-2101', name: 'Consulta Legal Inicial (Presencial o Virtual)', duration: 45, price: 30000, description: 'Revisión de caso con abogado especialista y emisión de criterio legal.' },
      { id: 'srv-2102', name: 'Autenticación de Firmas y Notariado', duration: 30, price: 20000, description: 'Certificaciones, declaraciones juradas y poderes notariales.' }
    ]
  },
  {
    id: 'biz-22',
    name: 'Soluciones Contables & Tributarias CR',
    slug: 'soluciones-contables-tributarias-cr',
    category: 'profesionales',
    categoryLabel: 'Servicios Legales y Contabilidad',
    rating: 4.8,
    reviewsCount: 65,
    priceRange: '₡₡',
    address: 'Belén, Centro Corporativo El Cafetal',
    city: 'Heredia, Belén',
    phone: '+506 2293 8811',
    email: 'info@solucionescontables.cr',
    description: 'Declaraciones de IVA y Renta ante ATV/Hacienda, contabilidad para pymes, facturación electrónica y planilla CCSS.',
    image: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Contadores Públicos Autorizados', 'Atención Ágil', 'Sinpe Móvil'],
    schedule: {
      days: [1, 2, 3, 4, 5],
      openTime: '08:00',
      closeTime: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p22-1",
            "url": "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=800&q=80",
            "title": "Despacho de Auditoría y Contabilidad"
      },
      {
            "id": "p22-2",
            "url": "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=800&q=80",
            "title": "Declaración de Impuestos y Hacienda"
      },
      {
            "id": "p22-3",
            "url": "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80",
            "title": "Análisis Financiero y Estados de Resultados"
      },
      {
            "id": "p22-4",
            "url": "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=80",
            "title": "Consultoría Tributaria para Pymes"
      },
      {
            "id": "p22-5",
            "url": "https://images.unsplash.com/photo-1554224154-26032ffc0d07?auto=format&fit=crop&w=800&q=80",
            "title": "Facturación Electrónica y Nóminas"
      },
      {
            "id": "p22-6",
            "url": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80",
            "title": "Planificación Financiera Estratégica"
      }
],
    services: [
      { id: 'srv-2201', name: 'Asesoría Tributaria y Diagnóstico Fiscal', duration: 45, price: 25000, description: 'Revisión de situación fiscal ante Ministerio de Hacienda y plan de ahorro tributario.' },
      { id: 'srv-2202', name: 'Certificación de Ingresos (CPA)', duration: 30, price: 35000, description: 'Documento oficial firmado por CPA para trámites bancarios y préstamos.' }
    ]
  },

  // ==========================================
  // 12. HOGAR, REPARACIONES Y LIMPIEZA
  // ==========================================
  {
    id: 'biz-23',
    name: 'ServiHogar - Electricidad, Plomería & Cerrajería',
    slug: 'servihogar-electricidad-plomeria-cerrajeria',
    category: 'hogar',
    categoryLabel: 'Hogar, Reparaciones y Limpieza',
    rating: 4.8,
    reviewsCount: 114,
    priceRange: '₡₡',
    address: 'San Rafael de Alajuela, Plaza Concasa',
    city: 'Alajuela',
    phone: '+506 8899 4433',
    email: 'contacto@servihogar.cr',
    description: 'Técnicos certificados para reparaciones del hogar: detección de fugas, cableado eléctrico, cerraduras de seguridad y pintura.',
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1505798577917-a65157d3320a?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Servicio a Domicilio', 'Garantía de Trabajo', 'Sinpe Móvil', 'Presupuesto Claro'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '07:30',
      closeTime: '18:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p23-1",
            "url": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80",
            "title": "Instalación y Revisión de Tableros Eléctricos"
      },
      {
            "id": "p23-2",
            "url": "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=800&q=80",
            "title": "Reparación de Tuberías y Fugas de Agua"
      },
      {
            "id": "p23-3",
            "url": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80",
            "title": "Cerrajería Residencial y Candados de Alta Seguridad"
      },
      {
            "id": "p23-4",
            "url": "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?auto=format&fit=crop&w=800&q=80",
            "title": "Instalación de Grifería y Accesorios de Baño"
      },
      {
            "id": "p23-5",
            "url": "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80",
            "title": "Iluminación LED y Tomas de Corriente"
      },
      {
            "id": "p23-6",
            "url": "https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80",
            "title": "Herramientas Profesionales y Trabajo Limpio"
      }
],
    services: [
      { id: 'srv-2301', name: 'Visita de Diagnóstico y Presupuesto', duration: 45, price: 10000, description: 'Inspección técnica en tu domicilio (monto rebajable del trabajo final).' },
      { id: 'srv-2302', name: 'Mantenimiento e Instalación Eléctrica Básica', duration: 60, price: 20000, description: 'Cambio de breakers, tomacorrientes, lámparas o instalación de duchas.' }
    ]
  },
  {
    id: 'biz-24',
    name: 'EcoClean CR - Limpieza de Muebles & Desinfección',
    slug: 'ecoclean-cr-limpieza-de-muebles-desinfeccion',
    category: 'hogar',
    categoryLabel: 'Hogar, Reparaciones y Limpieza',
    rating: 4.9,
    reviewsCount: 156,
    priceRange: '₡₡',
    address: 'Tibás Centro, 200m Sur del Estadio Ricardo Saprissa',
    city: 'San José, Tibás',
    phone: '+506 8755 2211',
    email: 'citas@ecocleancr.com',
    description: 'Lavado profesional a vapor y desinfección profunda de sillones, colchones, alfombras e interiores de vehículos a domicilio.',
    image: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Productos Biodegradables', 'Secado Rápido', 'Eliminación de Ácaros', 'Sinpe Móvil'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '08:00',
      closeTime: '17:00',
      breakStart: '12:00',
      breakEnd: '13:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p24-1",
            "url": "https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=800&q=80",
            "title": "Lavado de Sillones con Inyección y Succión"
      },
      {
            "id": "p24-2",
            "url": "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80",
            "title": "Desinfección de Colchones con Vapor Seco"
      },
      {
            "id": "p24-3",
            "url": "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
            "title": "Limpieza Profunda de Alfombras"
      },
      {
            "id": "p24-4",
            "url": "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80",
            "title": "Eliminación de Manchas en Comedores"
      },
      {
            "id": "p24-5",
            "url": "https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=800&q=80",
            "title": "Desinfección Segura para Niños y Mascotas"
      },
      {
            "id": "p24-6",
            "url": "https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=800&q=80",
            "title": "Muebles Impecables con Secado Rápido"
      }
],
    services: [
      { id: 'srv-2401', name: 'Lavado de Juego de Sala (3 Piezas)', duration: 90, price: 32000, description: 'Limpieza con máquina de inyección y extracción para eliminar manchas y olores.' },
      { id: 'srv-2402', name: 'Desinfección Profunda de Colchón Matrimonial / Queen', duration: 60, price: 22000, description: 'Tratamiento antiácaros con vapor a alta temperatura y secado.' }
    ]
  },

  // ==========================================
  // 13. PSICOLOGÍA Y TERAPIA
  // ==========================================
  {
    id: 'biz-25',
    name: 'Centro de Psicología & Bienestar Emocional',
    slug: 'centro-de-psicologia-bienestar-emocional',
    category: 'psicologia',
    categoryLabel: 'Psicología y Terapia',
    rating: 5.0,
    reviewsCount: 89,
    priceRange: '₡₡₡',
    address: 'Momentum Pinares, Torre Médica, Nivel 4',
    city: 'San José, Curridabat',
    phone: '+506 2272 9000',
    email: 'contacto@bienestaremocional.cr',
    description: 'Terapia psicológica para adultos y adolescentes. Manejo de ansiedad, estrés, duelo, depresión y crecimiento personal.',
    image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1527689368864-3a821dbccc34?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Psicólogos Colegiados', 'Consultorios Privados', 'Modalidad Presencial o Virtual', 'Confidencialidad Total'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '08:00',
      closeTime: '19:00',
      breakStart: '13:00',
      breakEnd: '14:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p25-1",
            "url": "https://images.unsplash.com/photo-1573497620053-ea5300f94f21?auto=format&fit=crop&w=800&q=80",
            "title": "Consultorio Terapéutico Privado y Cálido"
      },
      {
            "id": "p25-2",
            "url": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=800&q=80",
            "title": "Espacio Confortable de Escucha y Confianza"
      },
      {
            "id": "p25-3",
            "url": "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=800&q=80",
            "title": "Terapia de Pareja y Comunicación Aseriva"
      },
      {
            "id": "p25-4",
            "url": "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80",
            "title": "Manejo del Estrés, Ansiedad y Burnout"
      },
      {
            "id": "p25-5",
            "url": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80",
            "title": "Sala de Espera Íntima y Respetuosa"
      },
      {
            "id": "p25-6",
            "url": "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=800&q=80",
            "title": "Atención Profesional y Confidencial"
      }
],
    services: [
      { id: 'srv-2501', name: 'Sesión de Psicoterapia Individual (Adultos)', duration: 50, price: 32000, description: 'Espacio seguro y profesional basado en terapia cognitivo-conductual.' },
      { id: 'srv-2502', name: 'Terapia de Pareja', duration: 60, price: 42000, description: 'Herramientas de comunicación asertiva y resolución de conflictos de pareja.' }
    ]
  },
  {
    id: 'biz-26',
    name: 'Mente Plena - Psicopedagogía & Terapia Infantil',
    slug: 'mente-plena-psicopedagogia-terapia-infantil',
    category: 'psicologia',
    categoryLabel: 'Psicología y Terapia',
    rating: 4.9,
    reviewsCount: 62,
    priceRange: '₡₡₡',
    address: 'Guachipelín de Escazú, Plaza Real',
    city: 'San José, Escazú',
    phone: '+506 8844 5511',
    email: 'citas@menteplena.cr',
    description: 'Especialistas en psicología infantil, problemas de aprendizaje, déficit de atención (TDAH) y orientación a padres.',
    image: 'https://images.unsplash.com/photo-1590650516494-0c8e4a4dd67e?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Sala de Juegos Terapéutica', 'Evaluaciones Integrales', 'Parqueo Seguro'],
    schedule: {
      days: [1, 2, 3, 4, 5],
      openTime: '08:30',
      closeTime: '17:30',
      breakStart: '12:30',
      breakEnd: '13:30',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p26-1",
            "url": "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=800&q=80",
            "title": "Sala de Terapia Lúdica y Estimulación"
      },
      {
            "id": "p26-2",
            "url": "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80",
            "title": "Material Didáctico para Concentración"
      },
      {
            "id": "p26-3",
            "url": "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80",
            "title": "Acompañamiento en Dificultades de Aprendizaje"
      },
      {
            "id": "p26-4",
            "url": "https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=800&q=80",
            "title": "Espacio Cálido y Seguro para Niños"
      },
      {
            "id": "p26-5",
            "url": "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=800&q=80",
            "title": "Orientación a Padres y Familias"
      },
      {
            "id": "p26-6",
            "url": "https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?auto=format&fit=crop&w=800&q=80",
            "title": "Evaluación del Desarrollo Emocional"
      }
],
    services: [
      { id: 'srv-2601', name: 'Evaluación Psicológica / Psicopedagógica Infantil', duration: 60, price: 35000, description: 'Diagnóstico de habilidades de aprendizaje y estado emocional del niño.' },
      { id: 'srv-2602', name: 'Terapia de Juego y Emocional para Niños', duration: 45, price: 28000, description: 'Terapia lúdica para manejo de emociones y conducta.' }
    ]
  },

  // ==========================================
  // 14. TATUAJES Y PIERCING
  // ==========================================
  {
    id: 'biz-27',
    name: 'Pura Tinta Tattoo & Piercing Studio',
    slug: 'pura-tinta-tattoo-piercing-studio',
    category: 'tatuajes',
    categoryLabel: 'Tatuajes y Piercing',
    rating: 4.9,
    reviewsCount: 175,
    priceRange: '₡₡₡',
    address: 'Barrio Escalante, 50m Oeste del Fresh Market',
    city: 'San José',
    phone: '+506 8812 7700',
    email: 'ink@puratintatattoo.cr',
    description: 'Estudio de tatuajes artísticos: realismo, fineline, blackwork, tradicional y colocación de piercings corporales con titanio grado implante.',
    image: 'https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1562962230-16e4623d36e6?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Esterilización con Autoclave', 'Agujas Desechables 100%', 'Joyas de Titanio ASTM F-136', 'Sinpe Móvil'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '11:00',
      closeTime: '20:00',
      breakStart: '14:00',
      breakEnd: '15:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p27-1",
            "url": "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=800&q=80",
            "title": "Estación de Tatuar Esterilizada"
      },
      {
            "id": "p27-2",
            "url": "https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?auto=format&fit=crop&w=800&q=80",
            "title": "Tatuaje en Progreso con Agujas Selladas"
      },
      {
            "id": "p27-3",
            "url": "https://images.unsplash.com/photo-1562962230-16e4623d36e6?auto=format&fit=crop&w=800&q=80",
            "title": "Tintas Veganas y Calidad Profesional"
      },
      {
            "id": "p27-4",
            "url": "https://images.unsplash.com/photo-1542359649-31e03cd4d909?auto=format&fit=crop&w=800&q=80",
            "title": "Perforaciones con Joyería de Titanio Grado Implante"
      },
      {
            "id": "p27-5",
            "url": "https://images.unsplash.com/photo-1590246814883-5783307611ec?auto=format&fit=crop&w=800&q=80",
            "title": "Diseños Personalizados y Flash Art"
      },
      {
            "id": "p27-6",
            "url": "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=800&q=80",
            "title": "Tatuajes Cicatrizados con Colores Vivos"
      }
],
    services: [
      { id: 'srv-2701', name: 'Cotización y Diseño Personalizado de Tatuaje', duration: 30, price: 10000, description: 'Sesión con el artista para definir tamaño, estilo y boceto digital.' },
      { id: 'srv-2702', name: 'Tatuaje Fineline / Minimalista (Hasta 7 cm)', duration: 60, price: 35000, description: 'Trazos finos, delicados y precisos con tinta negra premium.' },
      { id: 'srv-2703', name: 'Perforación Corporal / Piercing con Joya Básica', duration: 30, price: 18000, description: 'Perforación aséptica en oreja, nariz o labio con joya de titanio incluida.' }
    ]
  },
  {
    id: 'biz-28',
    name: 'Black Lotus Tattoo Boutique',
    slug: 'black-lotus-tattoo-boutique',
    category: 'tatuajes',
    categoryLabel: 'Tatuajes y Piercing',
    rating: 5.0,
    reviewsCount: 98,
    priceRange: '₡₡₡',
    address: 'Heredia Centro, Costado Sur del Palacio de los Deportes',
    city: 'Heredia',
    phone: '+506 8722 3344',
    email: 'citas@blacklotustattoo.cr',
    description: 'Estudio de arte corporal femenino y masculino especializado en micropigmentación, microblading, cover-ups y tatuajes botánicos.',
    image: 'https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1560707303-4e980ce876ad?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Diseños Exclusivos', 'Ambiente Privado y Seguro', 'Garantía de Retoque'],
    schedule: {
      days: [2, 3, 4, 5, 6],
      openTime: '10:30',
      closeTime: '19:00',
      breakStart: '13:30',
      breakEnd: '14:30',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p28-1",
            "url": "https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?auto=format&fit=crop&w=800&q=80",
            "title": "Tatuajes Fine Line y Micro-Realismo"
      },
      {
            "id": "p28-2",
            "url": "https://images.unsplash.com/photo-1598371839696-5c5bb00bdc28?auto=format&fit=crop&w=800&q=80",
            "title": "Cabina Boutique Privada y Climatizada"
      },
      {
            "id": "p28-3",
            "url": "https://images.unsplash.com/photo-1562962230-16e4623d36e6?auto=format&fit=crop&w=800&q=80",
            "title": "Diseño Digital Exclusivo para Cada Cliente"
      },
      {
            "id": "p28-4",
            "url": "https://images.unsplash.com/photo-1542359649-31e03cd4d909?auto=format&fit=crop&w=800&q=80",
            "title": "Piercing de Oreja y Curaduría de Joyería"
      },
      {
            "id": "p28-5",
            "url": "https://images.unsplash.com/photo-1590246814883-5783307611ec?auto=format&fit=crop&w=800&q=80",
            "title": "Líneas Delicadas y Sombreado Suave"
      },
      {
            "id": "p28-6",
            "url": "https://images.unsplash.com/photo-1611501275019-9b5cda994e8d?auto=format&fit=crop&w=800&q=80",
            "title": "Asepsia Médica y Ambiente Agradable"
      }
],
    services: [
      { id: 'srv-2801', name: 'Microblading & Sombreado de Cejas', duration: 90, price: 55000, description: 'Diseño pelo a pelo para cejas naturales y definidas por 1 año.' },
      { id: 'srv-2802', name: 'Sesión de Tatuaje Botánico / Floral', duration: 120, price: 50000, description: 'Tatuaje a color o sombras de flores, plantas y fauna.' }
    ]
  },

  // ==========================================
  // 15. TECNOLOGÍA Y SOPORTE
  // ==========================================
  {
    id: 'biz-29',
    name: 'TechFix CR - Reparación de Laptops, Celulares & PC',
    slug: 'techfix-cr-reparacion-de-laptops-celulares-pc',
    category: 'tecnologia',
    categoryLabel: 'Tecnología y Soporte',
    rating: 4.8,
    reviewsCount: 142,
    priceRange: '₡₡',
    address: 'Mall San Pedro, Local 118, Sótano Tecnológico',
    city: 'San José, San Pedro',
    phone: '+506 2280 9911',
    email: 'soporte@techfix.cr',
    description: 'Centro de servicio técnico express. Cambio de pantallas, baterías, reparación de placas, mantenimiento térmico y rescate de datos.',
    image: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1588508065123-287b28e013da?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Garantía de 3 Meses', 'Repuestos Originales', 'Diagnóstico Express', 'Sinpe Móvil'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '09:30',
      closeTime: '19:00',
      breakStart: '13:00',
      breakEnd: '14:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p29-1",
            "url": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80",
            "title": "Estación de Micro-Soldadura y Diagnóstico"
      },
      {
            "id": "p29-2",
            "url": "https://images.unsplash.com/photo-1597740985671-2a8a3b80532e?auto=format&fit=crop&w=800&q=80",
            "title": "Cambio de Pantalla y Batería de Celulares"
      },
      {
            "id": "p29-3",
            "url": "https://images.unsplash.com/photo-1588508065123-287b28e013da?auto=format&fit=crop&w=800&q=80",
            "title": "Mantenimiento Térmico de Laptops y PC Gamer"
      },
      {
            "id": "p29-4",
            "url": "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=800&q=80",
            "title": "Instalación de Unidades SSD y Memoria RAM"
      },
      {
            "id": "p29-5",
            "url": "https://images.unsplash.com/photo-1563770660941-20978e870e26?auto=format&fit=crop&w=800&q=80",
            "title": "Repuestos Originales y Herramientas Especializadas"
      },
      {
            "id": "p29-6",
            "url": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80",
            "title": "Equipos Restaurados al 100% con Garantía"
      }
],
    services: [
      { id: 'srv-2901', name: 'Diagnóstico Técnico y Revisión de Equipo', duration: 30, price: 8000, description: 'Revisión minuciosa de hardware y software (gratis si se repara).' },
      { id: 'srv-2902', name: 'Mantenimiento Preventivo & Pasta Térmica (Laptop/PC)', duration: 60, price: 22000, description: 'Limpieza interna de ventiladores, cambio de pasta térmica Artic MX-4 y optimización.' },
      { id: 'srv-2903', name: 'Instalación de SSD y Clonación de Sistema', duration: 60, price: 28000, description: 'Multiplica la velocidad de tu computadora sin perder tus archivos.' }
    ]
  },
  {
    id: 'biz-30',
    name: 'CyberNet Soporte IT & Redes Empresariales',
    slug: 'cybernet-soporte-it-redes-empresariales',
    category: 'tecnologia',
    categoryLabel: 'Tecnología y Soporte',
    rating: 5.0,
    reviewsCount: 54,
    priceRange: '₡₡₡',
    address: 'San Francisco de Heredia, Edificio Tech Park',
    city: 'Heredia',
    phone: '+506 2261 4545',
    email: 'empresas@cybernetcr.com',
    description: 'Instalación de cámaras de seguridad CCTV, cableado estructurado, redes WiFi empresariales, servidores y ciberseguridad.',
    image: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Ingenieros Certificados Cisco', 'Soporte 24/7 Remoto', 'Factura Electrónica'],
    schedule: {
      days: [1, 2, 3, 4, 5],
      openTime: '08:00',
      closeTime: '17:30',
      breakStart: '12:00',
      breakEnd: '13:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p30-1",
            "url": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80",
            "title": "Gabinete de Servidores y Cableado Estructurado"
      },
      {
            "id": "p30-2",
            "url": "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=800&q=80",
            "title": "Monitoreo y Mantenimiento de Redes Empresariales"
      },
      {
            "id": "p30-3",
            "url": "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80",
            "title": "Instalación de Routers y Firewalls de Seguridad"
      },
      {
            "id": "p30-4",
            "url": "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80",
            "title": "Sistemas de Respaldo y Ciberseguridad"
      },
      {
            "id": "p30-5",
            "url": "https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80",
            "title": "Soporte Técnico en Sitio para Empresas"
      },
      {
            "id": "p30-6",
            "url": "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80",
            "title": "Conectividad Ininterrumpida y Alta Disponibilidad"
      }
],
    services: [
      { id: 'srv-3001', name: 'Inspección en Sitio para Cámaras / Redes WiFi', duration: 60, price: 20000, description: 'Estudio de cobertura inalámbrica y diseño de puntos de red.' },
      { id: 'srv-3002', name: 'Soporte Remoto Express de Computadoras (1 Hora)', duration: 60, price: 18000, description: 'Limpieza de virus, configuración de impresoras, correos y programas.' }
    ]
  },

  // ==========================================
  // 16. OTROS SERVICIOS
  // ==========================================
  {
    id: 'biz-31',
    name: 'Lavandería & Tintorería Exprés Costa Rica',
    slug: 'lavanderia-tintoreria-expres-costa-rica',
    category: 'otros',
    categoryLabel: 'Otros Servicios',
    rating: 4.8,
    reviewsCount: 130,
    priceRange: '₡₡',
    address: 'Rohrmoser, 150m Oeste del Estadio Nacional',
    city: 'San José, Rohrmoser',
    phone: '+506 2232 5500',
    email: 'contacto@lavanderiaexpres.cr',
    description: 'Servicio de lavado, planchado, tintorería en seco para trajes y vestidos de fiesta, y lavado de edredones con entrega a domicilio.',
    image: 'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Entrega a Domicilio', 'Cuidado de Telas Finas', 'Sinpe Móvil', 'Express en 24h'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '07:30',
      closeTime: '18:30',
      breakStart: '12:30',
      breakEnd: '13:30',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p31-1",
            "url": "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80",
            "title": "Lavadoras y Secadoras Industriales de Alta Capacidad"
      },
      {
            "id": "p31-2",
            "url": "https://images.unsplash.com/photo-1582735689369-4fe89db7114c?auto=format&fit=crop&w=800&q=80",
            "title": "Planchado al Vapor para Trajes y Camisas"
      },
      {
            "id": "p31-3",
            "url": "https://images.unsplash.com/photo-1489274495757-95c7c837b101?auto=format&fit=crop&w=800&q=80",
            "title": "Lavado en Seco y Cuidado de Telas Finas"
      },
      {
            "id": "p31-4",
            "url": "https://images.unsplash.com/photo-1545173168-9f1947eebb7f?auto=format&fit=crop&w=800&q=80",
            "title": "Lavado de Edredones King y Cobertores"
      },
      {
            "id": "p31-5",
            "url": "https://images.unsplash.com/photo-1521566652839-697aa473761a?auto=format&fit=crop&w=800&q=80",
            "title": "Empaque y Doblado Profesional Protegido"
      },
      {
            "id": "p31-6",
            "url": "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?auto=format&fit=crop&w=800&q=80",
            "title": "Servicio Exprés y Entrega Puntual"
      }
],
    services: [
      { id: 'srv-3101', name: 'Tintorería en Seco para Traje Completo (2 Piezas)', duration: 30, price: 12000, description: 'Limpieza especializada de saco y pantalón con planchado al vapor.' },
      { id: 'srv-3102', name: 'Lavado y Planchado de Edredón King / Queen', duration: 30, price: 14000, description: 'Lavado en máquinas industriales de gran capacidad y empaque sellado.' }
    ]
  },
  {
    id: 'biz-32',
    name: 'Eventos & Logística Mágica CR',
    slug: 'eventos-logistica-magica-cr',
    category: 'otros',
    categoryLabel: 'Otros Servicios',
    rating: 5.0,
    reviewsCount: 88,
    priceRange: '₡₡₡',
    address: 'Lindora, Centro Comercial Terrazas, Local 22',
    city: 'San José, Santa Ana',
    phone: '+506 8990 1122',
    email: 'eventos@logiticamagica.cr',
    description: 'Planificación integral de eventos corporativos, cumpleaños, baby showers, decoración temática, sonido y catering.',
    image: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1200&q=80',
    isDemo: true,
    features: ['Decoración Personalizada', 'Asesoría Dedicada', 'Alquiler de Mobiliario', 'Factura Electrónica'],
    schedule: {
      days: [1, 2, 3, 4, 5, 6],
      openTime: '09:00',
      closeTime: '18:00',
      breakStart: '13:00',
      breakEnd: '14:00',
      slotDuration: 30
    },
    portfolio: [
      {
            "id": "p32-1",
            "url": "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80",
            "title": "Montaje de Banquete y Decoración Elegante"
      },
      {
            "id": "p32-2",
            "url": "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=800&q=80",
            "title": "Centros de Mesa Florales y Candelabros"
      },
      {
            "id": "p32-3",
            "url": "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80",
            "title": "Arcos de Globos y Backdrops para Fotos"
      },
      {
            "id": "p32-4",
            "url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80",
            "title": "Iluminación Ambiental y Guirnaldas Festivas"
      },
      {
            "id": "p32-5",
            "url": "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=800&q=80",
            "title": "Mesa de Dulces y Postres Temáticos"
      },
      {
            "id": "p32-6",
            "url": "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=800&q=80",
            "title": "Celebraciones Inolvidables y Logística Total"
      }
],
    services: [
      { id: 'srv-3201', name: 'Reunión de Planificación y Asesoría de Evento', duration: 60, price: 15000, description: 'Definición de concepto, cronograma, presupuesto y selección de proveedores.' },
      { id: 'srv-3202', name: 'Paquete de Decoración Temática Básica', duration: 60, price: 75000, description: 'Arco de globos orgánico, backing temático, mesitas cilíndricas y luces.' }
    ]
  }
];

export const INITIAL_CLIENTS = [
  {
    id: 'cli-demo-1',
    name: 'Carlos Mendoza (Cliente Demo)',
    phone: '+506 8899 1122',
    email: 'cliente@demo.cr',
    password: '123'
  },
  {
    id: 'cli-demo-2',
    name: 'Usuario Prueba',
    phone: '+506 7000 1122',
    email: 'usuario@demo.cr',
    password: '123'
  },
  {
    id: 'cli-demo-3',
    name: 'Juan Cliente',
    phone: '+506 8888 7777',
    email: 'juan.cliente@demo.cr',
    password: '123'
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
    clientName: 'Carlos Mendoza (Cliente Demo)',
    clientPhone: '+506 8899 1122',
    clientEmail: 'carlos.m@example.com',
    notes: 'Preferencia corte fade bajo.',
    clientEmail: 'cliente@demo.cr',
    notes: 'Preferencia corte fade bajo con toalla caliente.',
    status: 'confirmed',
    createdAt: new Date().toISOString()
  },
  {
    id: 'apt-002',
    businessId: 'biz-1',
    serviceId: 'srv-103',
    serviceName: 'Combo Premium (Corte + Barba)',
    servicePrice: 11000,
    businessId: 'biz-2',
    serviceId: 'srv-201',
    serviceName: 'Manicura Rusa & Gel Semipermanente',
    servicePrice: 16000,
    serviceDuration: 60,
    date: new Date().toISOString().split('T')[0],
    time: '11:30',
    clientName: 'Alejandro Rivera',
    clientPhone: '+506 8765 1234',
    clientEmail: 'alejandro.r@example.com',
    notes: 'Primera visita al local.',
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    time: '14:30',
    clientName: 'Carlos Mendoza (Cliente Demo)',
    clientPhone: '+506 8899 1122',
    clientEmail: 'cliente@demo.cr',
    notes: 'Diseño minimalista.',
    status: 'pending',
    createdAt: new Date().toISOString()
  },
  {
    id: 'apt-003',
    businessId: 'biz-3',
    serviceId: 'srv-301',
    businessId: 'biz-7',
    serviceId: 'srv-701',
    serviceName: 'Masaje Relajante con Aromaterapia',
    servicePrice: 22000,
    serviceDuration: 60,
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    date: new Date(Date.now() + 172800000).toISOString().split('T')[0],
    time: '16:00',
    clientName: 'Mariana Gómez',
    clientPhone: '+506 7011 2233',
    clientEmail: 'mariana.g@example.com',
    notes: 'Enfoque en zona lumbar.',
    clientName: 'Usuario Prueba',
    clientPhone: '+506 7000 1122',
    clientEmail: 'usuario@demo.cr',
    notes: 'Enfoque en zona lumbar y cuello.',
    status: 'confirmed',
    createdAt: new Date().toISOString()
  },
  {
    id: 'apt-004',
    businessId: 'biz-5',
    serviceId: 'srv-502',
    serviceName: 'Limpieza Dental con Ultrasonido',
    servicePrice: 25000,
    serviceDuration: 45,
    date: new Date(Date.now() + 172800000).toISOString().split('T')[0],
    date: new Date(Date.now() + 259200000).toISOString().split('T')[0],
    time: '09:00',
    clientName: 'Esteban Solís',
    clientPhone: '+506 8822 4466',
    clientEmail: 'esteban.solis@example.com',
    notes: 'Chequeo semestral.',
    status: 'confirmed',
    createdAt: new Date().toISOString()
  }
];

export const INITIAL_STAFF = [
  // ==========================================
  // 1. Barbería & Estilo Vintage (biz-1)
  // ==========================================
  {
    id: 'staff-101',
    businessId: 'biz-1',
    name: 'Carlos Mora',
    roleTitle: 'Master Barber & Fundador',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    phone: '+506 8877 6651',
    services: ['all'],
    schedule: null,
    isActive: true
  },
  {
    id: 'staff-102',
    businessId: 'biz-1',
    name: 'Bryan Salazar',
    roleTitle: 'Especialista en Barba y Navaja',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    phone: '+506 8877 6652',
    services: ['srv-102', 'srv-103', 'srv-104'],
    schedule: null,
    isActive: true
  },
  {
    id: 'staff-103',
    businessId: 'biz-1',
    name: 'Mateo Fernández',
    roleTitle: 'Estilista Urbano & Cortes Fade',
    avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=400&q=80',
    phone: '+506 8877 6653',
    services: ['srv-101', 'srv-103'],
    schedule: null,
    isActive: true
  },

  // ==========================================
  // 2. Studio GLAM Salón & Nails Lounge (biz-2)
  // ==========================================
  {
    id: 'staff-201',
    businessId: 'biz-2',
    name: 'Valeria Chacón',
    roleTitle: 'Especialista en Uñas & Manicura Rusa',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    phone: '+506 8344 1123',
    services: ['srv-201', 'srv-202'],
    schedule: null,
    isActive: true
  },
  {
    id: 'staff-202',
    businessId: 'biz-2',
    name: 'Sofía Valverde',
    roleTitle: 'Master Stylist & Keratinas',
    avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
    phone: '+506 8344 1124',
    services: ['srv-203'],
    schedule: null,
    isActive: true
  },
  {
    id: 'staff-203',
    businessId: 'biz-2',
    name: 'Camila Rojas',
    roleTitle: 'Estilista Integral & Tratamientos',
    avatarUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80',
    phone: '+506 8344 1125',
    services: ['all'],
    schedule: null,
    isActive: true
  },

  // ==========================================
  // 3. Centro Médico Familiar del Este (biz-3)
  // ==========================================
  {
    id: 'staff-301',
    businessId: 'biz-3',
    name: 'Dra. Elena Castro',
    roleTitle: 'Médico General & Preventivo',
    avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=400&q=80',
    phone: '+506 2271 8891',
    services: ['all'],
    schedule: null,
    isActive: true
  },
  {
    id: 'staff-302',
    businessId: 'biz-3',
    name: 'Dr. Alejandro Méndez',
    roleTitle: 'Médico Internista',
    avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=400&q=80',
    phone: '+506 2271 8892',
    services: ['srv-301', 'srv-302'],
    schedule: null,
    isActive: true
  }
];

