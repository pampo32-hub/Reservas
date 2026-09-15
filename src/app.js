// Controlador principal de la aplicación
import { storage } from './services/storage.js';

class App {
  constructor() {
    this.currentView = 'directory'; // 'directory' | 'business-detail' | 'owner-dashboard' | 'my-bookings'
    this.selectedBusinessId = null;
    this.selectedCategory = 'all';
    this.searchQuery = '';
    
    // Estado del modal de reserva
    this.bookingState = {
      isOpen: false,
      businessId: null,
      serviceId: null,
      selectedDate: this.getTodayDateString(),
      selectedTime: null
    };

    // Estado del panel de dueño
    this.activeDashboardTab = 'appointments'; // 'appointments' | 'services' | 'schedule' | 'profile'
  }

  getTodayDateString() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  init() {
    this.renderHeader();
    this.renderCurrentView();
    this.setupGlobalEvents();
  }

  // --- NAVEGACIÓN ---
  navigateTo(view, params = {}) {
    this.currentView = view;
    if (params.businessId) {
      this.selectedBusinessId = params.businessId;
    }
    this.renderHeader();
    this.renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- NOTIFICACIONES TOAST ---
  showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    const bgClass = type === 'success' ? 'bg-emerald-600 text-white' : type === 'error' ? 'bg-rose-600 text-white' : 'bg-slate-800 text-white';
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';

    toast.className = `flex items-center gap-3 px-5 py-3 rounded-xl shadow-xl ${bgClass} animate-fade-in transition-all duration-300 font-medium text-sm`;
    toast.innerHTML = `<i class="fas ${icon} text-lg"></i> <span>${message}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // --- HEADER / NAVBAR ---
  renderHeader() {
    const headerContainer = document.getElementById('navbar-container');
    if (!headerContainer) return;

    headerContainer.innerHTML = `
      <header class="sticky top-0 z-40 glass-header border-b border-slate-200/80 shadow-xs">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <!-- Logo -->
          <div class="flex items-center gap-3 cursor-pointer select-none" id="nav-logo-btn">
            <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <i class="fas fa-calendar-check text-xl"></i>
            </div>
            <div>
              <span class="font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">TurnoYa</span>
              <span class="text-xs block text-slate-500 font-medium">Directorio & Reservas</span>
            </div>
          </div>

          <!-- Navigation Links -->
          <nav class="flex items-center gap-2 sm:gap-3">
            <button id="nav-directory-btn" class="px-4 py-2 rounded-xl text-sm font-semibold transition-all ${this.currentView === 'directory' || this.currentView === 'business-detail' ? 'bg-blue-50 text-blue-700 shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
              <i class="fas fa-compass mr-1.5"></i> Explorar Negocios
            </button>

            <button id="nav-dashboard-btn" class="px-4 py-2 rounded-xl text-sm font-semibold transition-all ${this.currentView === 'owner-dashboard' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25' : 'bg-slate-900 hover:bg-slate-800 text-white'}">
              <i class="fas fa-store mr-1.5"></i> Panel Dueño de Negocio
            </button>
          </nav>
        </div>
      </header>
    `;

    document.getElementById('nav-logo-btn')?.addEventListener('click', () => this.navigateTo('directory'));
    document.getElementById('nav-directory-btn')?.addEventListener('click', () => this.navigateTo('directory'));
    document.getElementById('nav-dashboard-btn')?.addEventListener('click', () => this.navigateTo('owner-dashboard'));
  }

  // --- GESTIÓN DE VISTAS ---
  renderCurrentView() {
    const main = document.getElementById('main-content');
    if (!main) return;

    switch (this.currentView) {
      case 'directory':
        this.renderDirectoryView(main);
        break;
      case 'business-detail':
        this.renderBusinessDetailView(main);
        break;
      case 'owner-dashboard':
        this.renderOwnerDashboardView(main);
        break;
      default:
        this.renderDirectoryView(main);
    }
  }

  // ==========================================
  // VISTA 1: DIRECTORIO DE NEGOCIOS (CLIENTE)
  // ==========================================
  renderDirectoryView(container) {
    const categories = storage.getCategories();
    let businesses = storage.getBusinesses();

    // Filtros
    if (this.selectedCategory !== 'all') {
      businesses = businesses.filter(b => b.category === this.selectedCategory);
    }
    if (this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase();
      businesses = businesses.filter(b => 
        b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.city.toLowerCase().includes(q) ||
        b.services.some(s => s.name.toLowerCase().includes(q))
      );
    }

    container.innerHTML = `
      <div class="animate-fade-in pb-20">
        <!-- Hero Section -->
        <section class="relative bg-gradient-to-b from-blue-50/70 via-white to-slate-50 border-b border-slate-200/70 py-16 px-4 sm:px-6 lg:px-8">
          <div class="max-w-4xl mx-auto text-center">
            <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/80 text-blue-700 text-xs font-bold uppercase tracking-wider mb-4">
              <i class="fas fa-bolt text-blue-600"></i> Reserva sin esperas ni llamadas
            </span>
            <h1 class="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Encuentra y reserva en los mejores <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">negocios locales</span>
            </h1>
            <p class="mt-4 text-slate-600 text-base sm:text-lg max-w-2xl mx-auto">
              Barberías, spas, consultas médicas, talleres y más. Elige el servicio, selecciona tu horario ideal y asegura tu turno al instante.
            </p>

            <!-- Search Bar -->
            <div class="mt-8 max-w-2xl mx-auto relative flex items-center shadow-xl rounded-2xl bg-white border border-slate-200 p-2">
              <div class="pl-4 text-slate-400">
                <i class="fas fa-search text-lg"></i>
              </div>
              <input 
                type="text" 
                id="search-input" 
                value="${this.searchQuery}" 
                placeholder="Busca por servicio (ej. 'corte', 'masaje', 'dentista') o nombre..." 
                class="w-full px-4 py-3 text-slate-800 placeholder-slate-400 bg-transparent text-sm sm:text-base focus:outline-none"
              />
              ${this.searchQuery ? `
                <button id="clear-search-btn" class="p-2 text-slate-400 hover:text-slate-600 mr-2">
                  <i class="fas fa-times-circle"></i>
                </button>
              ` : ''}
              <button id="do-search-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-md shadow-blue-500/20 text-sm">
                Buscar
              </button>
            </div>
          </div>
        </section>

        <!-- Category Filter Pills -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
          <div class="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar">
            ${categories.map(cat => `
              <button 
                class="category-pill-btn flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-all ${this.selectedCategory === cat.id ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}"
                data-category-id="${cat.id}"
              >
                <i class="fas ${cat.icon} text-sm"></i>
                <span>${cat.name}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Business Cards Grid -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-slate-900">
              ${this.selectedCategory === 'all' ? 'Todos los Establecimientos' : categories.find(c => c.id === this.selectedCategory)?.name || 'Negocios'} 
              <span class="text-sm font-normal text-slate-500 ml-2">(${businesses.length} disponibles)</span>
            </h2>
          </div>

          ${businesses.length === 0 ? `
            <div class="text-center py-20 bg-white rounded-3xl border border-slate-200 p-8 max-w-md mx-auto">
              <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4 text-2xl">
                <i class="fas fa-search"></i>
              </div>
              <h3 class="text-lg font-bold text-slate-800">No encontramos resultados</h3>
              <p class="text-sm text-slate-500 mt-1">Prueba con otra palabra clave o selecciona otra categoría.</p>
              <button id="reset-filter-btn" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700">
                Ver todos los negocios
              </button>
            </div>
          ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              ${businesses.map(biz => `
                <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group hover:-translate-y-1">
                  <!-- Image Header -->
                  <div class="relative h-48 overflow-hidden bg-slate-100">
                    <img src="${biz.image}" alt="${biz.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20"></div>
                    
                    <span class="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-slate-800 shadow-sm">
                      ${biz.categoryLabel}
                    </span>

                    <span class="absolute top-3 right-3 bg-amber-400 text-slate-900 px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1 shadow-sm">
                      <i class="fas fa-star text-xs"></i> ${biz.rating} <span class="text-slate-700 font-normal">(${biz.reviewsCount})</span>
                    </span>

                    <div class="absolute bottom-3 left-3 right-3 text-white">
                      <span class="text-xs font-medium text-slate-200 flex items-center gap-1">
                        <i class="fas fa-map-marker-alt text-rose-400"></i> ${biz.city}
                      </span>
                    </div>
                  </div>

                  <!-- Content Body -->
                  <div class="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 class="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        ${biz.name}
                      </h3>
                      <p class="text-xs text-slate-500 mt-1 line-clamp-2">
                        ${biz.description}
                      </p>

                      <!-- Schedule info -->
                      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                        <span class="flex items-center gap-1.5">
                          <i class="far fa-clock text-blue-600"></i> 
                          ${biz.schedule.openTime} - ${biz.schedule.closeTime}
                        </span>
                        <span class="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          ${biz.services.length} servicios disp.
                        </span>
                      </div>
                    </div>

                    <!-- Action Button -->
                    <div class="mt-5 pt-3">
                      <button 
                        class="view-biz-btn w-full py-2.5 px-4 bg-slate-900 hover:bg-blue-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
                        data-business-id="${biz.id}"
                      >
                        <span>Ver Servicios & Reservar</span>
                        <i class="fas fa-arrow-right text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;

    // Listeners
    const searchInput = document.getElementById('search-input');
    const doSearchBtn = document.getElementById('do-search-btn');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const resetFilterBtn = document.getElementById('reset-filter-btn');

    const handleSearch = () => {
      this.searchQuery = searchInput.value;
      this.renderCurrentView();
    };

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSearch();
    });
    doSearchBtn?.addEventListener('click', handleSearch);
    clearSearchBtn?.addEventListener('click', () => {
      this.searchQuery = '';
      this.renderCurrentView();
    });
    resetFilterBtn?.addEventListener('click', () => {
      this.searchQuery = '';
      this.selectedCategory = 'all';
      this.renderCurrentView();
    });

    // Filtros de categoría
    document.querySelectorAll('.category-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedCategory = btn.getAttribute('data-category-id');
        this.renderCurrentView();
      });
    });

    // Botones de Ver Negocio
    document.querySelectorAll('.view-biz-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const bId = btn.getAttribute('data-business-id');
        this.navigateTo('business-detail', { businessId: bId });
      });
    });
  }

  // ==========================================
  // VISTA 2: DETALLE DEL NEGOCIO & SERVICIOS
  // ==========================================
  renderBusinessDetailView(container) {
    const biz = storage.getBusinessById(this.selectedBusinessId);
    if (!biz) {
      this.navigateTo('directory');
      return;
    }

    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const activeDaysText = biz.schedule.days.map(d => dayNames[d]).join(', ');

    container.innerHTML = `
      <div class="animate-fade-in pb-20">
        <!-- Back button & Cover -->
        <div class="relative bg-slate-900 h-64 sm:h-80 w-full overflow-hidden">
          <img src="${biz.coverImage || biz.image}" alt="${biz.name}" class="w-full h-full object-cover opacity-60">
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent"></div>

          <div class="absolute top-6 left-4 sm:left-8 z-10">
            <button id="back-to-directory-btn" class="px-4 py-2 rounded-xl bg-white/90 hover:bg-white text-slate-800 text-sm font-bold flex items-center gap-2 shadow-lg backdrop-blur-md transition-all">
              <i class="fas fa-arrow-left"></i> Volver al Directorio
            </button>
          </div>

          <div class="absolute bottom-6 left-4 sm:left-8 right-4 sm:right-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 text-white">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="px-3 py-0.5 rounded-full bg-blue-600 text-white text-xs font-bold uppercase tracking-wider">
                  ${biz.categoryLabel}
                </span>
                <span class="bg-amber-400 text-slate-900 px-2 py-0.5 rounded-md text-xs font-bold flex items-center gap-1">
                  <i class="fas fa-star text-xs"></i> ${biz.rating} (${biz.reviewsCount} reseñas)
                </span>
              </div>
              <h1 class="text-2xl sm:text-4xl font-extrabold tracking-tight">${biz.name}</h1>
              <p class="text-sm text-slate-300 mt-1 flex items-center gap-1.5">
                <i class="fas fa-map-marker-alt text-rose-400"></i> ${biz.address}, ${biz.city}
              </p>
            </div>
          </div>
        </div>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Columna Izquierda: Servicios y Catálogo (2 cols) -->
          <div class="lg:col-span-2 space-y-6">
            <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
              <h2 class="text-xl font-bold text-slate-900 mb-2">Servicios Disponibles</h2>
              <p class="text-sm text-slate-500 mb-6">Selecciona el servicio que deseas para ver horarios y agendar tu cita.</p>

              <div class="space-y-4">
                ${biz.services.map(srv => `
                  <div class="p-5 rounded-2xl border border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div class="flex-1">
                      <div class="flex items-center gap-3">
                        <h3 class="font-bold text-base text-slate-900">${srv.name}</h3>
                        <span class="px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-700 text-xs font-semibold">
                          <i class="far fa-clock mr-1 text-slate-500"></i>${srv.duration} min
                        </span>
                      </div>
                      <p class="text-xs text-slate-500 mt-1.5">${srv.description}</p>
                    </div>

                    <div class="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3">
                      <span class="text-lg font-extrabold text-blue-600">$${srv.price}</span>
                      <button 
                        class="book-service-btn px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5"
                        data-service-id="${srv.id}"
                      >
                        <i class="fas fa-calendar-plus"></i> Reservar
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Reseñas y Sobre Nosotros -->
            <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
              <h2 class="text-lg font-bold text-slate-900 mb-3">Sobre el Establecimiento</h2>
              <p class="text-sm text-slate-600 leading-relaxed">${biz.description}</p>
            </div>
          </div>

          <!-- Columna Derecha: Información de Contacto y Horarios (1 col) -->
          <div class="space-y-6">
            <!-- Contact Box -->
            <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 class="font-bold text-base text-slate-900">Contacto Directo</h3>
              
              <div class="space-y-3 text-sm">
                <div class="flex items-center gap-3 text-slate-600">
                  <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-phone-alt text-xs"></i>
                  </div>
                  <span>${biz.phone}</span>
                </div>

                <div class="flex items-center gap-3 text-slate-600">
                  <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-envelope text-xs"></i>
                  </div>
                  <span class="truncate">${biz.email}</span>
                </div>

                <div class="flex items-center gap-3 text-slate-600">
                  <div class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-map-pin text-xs"></i>
                  </div>
                  <span>${biz.address}</span>
                </div>
              </div>

              <div class="pt-4 border-t border-slate-100">
                <a href="https://wa.me/${biz.phone.replace(/[^0-9]/g, '')}" target="_blank" class="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                  <i class="fab fa-whatsapp text-sm"></i> Chatear por WhatsApp
                </a>
              </div>
            </div>

            <!-- Schedule Box -->
            <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
              <h3 class="font-bold text-base text-slate-900 mb-3 flex items-center gap-2">
                <i class="far fa-clock text-blue-600"></i> Horario de Atención
              </h3>

              <div class="space-y-2 text-xs text-slate-600">
                <div class="flex justify-between py-1.5 border-b border-slate-100">
                  <span class="font-medium">Días laborales:</span>
                  <span class="font-bold text-slate-800 text-right">${activeDaysText}</span>
                </div>
                <div class="flex justify-between py-1.5 border-b border-slate-100">
                  <span class="font-medium">Horario de apertura:</span>
                  <span class="font-bold text-slate-800">${biz.schedule.openTime} - ${biz.schedule.closeTime}</span>
                </div>
                ${biz.schedule.breakStart ? `
                  <div class="flex justify-between py-1.5 text-amber-700 bg-amber-50 px-2 rounded-lg">
                    <span class="font-medium">Receso / Almuerzo:</span>
                    <span class="font-bold">${biz.schedule.breakStart} - ${biz.schedule.breakEnd}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('back-to-directory-btn')?.addEventListener('click', () => this.navigateTo('directory'));

    document.querySelectorAll('.book-service-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-service-id');
        this.openBookingModal(biz.id, sId);
      });
    });
  }

  // ==========================================
  // MODAL DE RESERVA EN TIEMPO REAL
  // ==========================================
  openBookingModal(businessId, serviceId) {
    this.bookingState = {
      isOpen: true,
      businessId,
      serviceId,
      selectedDate: this.getTodayDateString(),
      selectedTime: null
    };
    this.renderBookingModal();
  }

  closeBookingModal() {
    this.bookingState.isOpen = false;
    const modalContainer = document.getElementById('modal-container');
    if (modalContainer) modalContainer.innerHTML = '';
  }

  renderBookingModal() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer || !this.bookingState.isOpen) return;

    const biz = storage.getBusinessById(this.bookingState.businessId);
    const service = biz?.services.find(s => s.id === this.bookingState.serviceId) || biz?.services[0];
    if (!biz || !service) return;

    // Calcular franjas horarias disponibles para la fecha seleccionada
    const availability = storage.getAvailableSlots(biz.id, this.bookingState.selectedDate, service.duration);

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-8">
          <!-- Header -->
          <div class="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex items-center justify-between">
            <div>
              <span class="text-xs uppercase tracking-wider text-blue-200 font-bold">Reserva de Turno</span>
              <h3 class="text-xl font-bold">${biz.name}</h3>
            </div>
            <button id="close-modal-btn" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            <!-- Servicio seleccionado -->
            <div class="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <span class="text-xs text-blue-600 font-semibold uppercase">Servicio</span>
                <h4 class="font-bold text-slate-900">${service.name}</h4>
                <span class="text-xs text-slate-500"><i class="far fa-clock mr-1"></i>${service.duration} minutos</span>
              </div>
              <div class="text-right">
                <span class="text-lg font-black text-blue-700">$${service.price}</span>
              </div>
            </div>

            <!-- Paso 1: Seleccionar Fecha -->
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                1. Selecciona la Fecha
              </label>
              <input 
                type="date" 
                id="booking-date-input" 
                value="${this.bookingState.selectedDate}" 
                min="${this.getTodayDateString()}" 
                class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <!-- Paso 2: Horarios Disponibles en Tiempo Real -->
            <div>
              <div class="flex items-center justify-between mb-2">
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Horario Disponible (${availability.slots ? availability.slots.length : 0} libres)
                </label>
              </div>

              ${availability.isClosed ? `
                <div class="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2">
                  <i class="fas fa-calendar-times text-base"></i>
                  <span>${availability.reason}</span>
                </div>
              ` : availability.slots.length === 0 ? `
                <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-center gap-2">
                  <i class="fas fa-info-circle text-base"></i>
                  <span>No hay turnos disponibles para esta fecha. Intenta con otro día.</span>
                </div>
              ` : `
                <div class="grid grid-cols-3 sm:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-1">
                  ${availability.slots.map(slot => `
                    <button 
                      type="button" 
                      class="time-slot-btn py-2.5 px-3 text-xs font-bold rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50 text-slate-700 text-center ${this.bookingState.selectedTime === slot ? 'selected' : ''}"
                      data-slot="${slot}"
                    >
                      <i class="far fa-clock mr-1 text-[10px]"></i>${slot}
                    </button>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- Paso 3: Datos de Contacto -->
            <form id="booking-form" class="space-y-3 pt-3 border-t border-slate-100">
              <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                3. Tus Datos para la Reserva
              </label>

              <div>
                <input 
                  type="text" 
                  id="client-name" 
                  placeholder="Nombre y Apellidos *" 
                  required 
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input 
                  type="tel" 
                  id="client-phone" 
                  placeholder="Teléfono / WhatsApp *" 
                  required 
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <input 
                  type="email" 
                  id="client-email" 
                  placeholder="Correo Electrónico" 
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <textarea 
                  id="client-notes" 
                  placeholder="Notas adicionales o preferencias (opcional)" 
                  rows="2" 
                  class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                ></textarea>
              </div>

              <!-- Submit button -->
              <button 
                type="submit" 
                id="submit-booking-btn"
                ${!this.bookingState.selectedTime ? 'disabled' : ''}
                class="w-full mt-4 py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
              >
                <i class="fas fa-check-circle"></i>
                <span>Confirmar Reserva ${this.bookingState.selectedTime ? `(${this.bookingState.selectedTime})` : ''}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    // Listeners del modal
    document.getElementById('close-modal-btn')?.addEventListener('click', () => this.closeBookingModal());

    const dateInput = document.getElementById('booking-date-input');
    dateInput?.addEventListener('change', (e) => {
      this.bookingState.selectedDate = e.target.value;
      this.bookingState.selectedTime = null;
      this.renderBookingModal();
    });

    document.querySelectorAll('.time-slot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.bookingState.selectedTime = btn.getAttribute('data-slot');
        this.renderBookingModal();
      });
    });

    // Envío del formulario de reserva
    const form = document.getElementById('booking-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!this.bookingState.selectedTime) {
        this.showToast('Por favor selecciona una hora disponible.', 'error');
        return;
      }

      const clientName = document.getElementById('client-name').value;
      const clientPhone = document.getElementById('client-phone').value;
      const clientEmail = document.getElementById('client-email').value;
      const clientNotes = document.getElementById('client-notes').value;

      const newAppointment = storage.createAppointment({
        businessId: biz.id,
        serviceId: service.id,
        serviceName: service.name,
        servicePrice: service.price,
        serviceDuration: service.duration,
        date: this.bookingState.selectedDate,
        time: this.bookingState.selectedTime,
        clientName,
        clientPhone,
        clientEmail,
        notes: clientNotes,
        status: 'confirmed'
      });

      this.closeBookingModal();
      this.renderSuccessBookingModal(newAppointment, biz);
      this.showToast('¡Reserva confirmada con éxito!', 'success');
    });
  }

  // --- MODAL DE ÉXITO DE RESERVA ---
  renderSuccessBookingModal(appointment, business) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 text-center p-6 sm:p-8">
          <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 animate-bounce">
            <i class="fas fa-check"></i>
          </div>

          <span class="text-xs uppercase font-extrabold text-emerald-600 tracking-wider">¡Turno Agendado!</span>
          <h3 class="text-2xl font-black text-slate-900 mt-1">Cita Confirmada</h3>
          <p class="text-xs text-slate-500 mt-1">Código de reserva: <strong class="text-slate-800 font-mono">${appointment.id.toUpperCase()}</strong></p>

          <!-- Ticket resumen -->
          <div class="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-2.5">
            <div class="flex justify-between">
              <span class="text-slate-500">Establecimiento:</span>
              <span class="font-bold text-slate-800">${business.name}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Servicio:</span>
              <span class="font-bold text-slate-800">${appointment.serviceName}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Fecha y Hora:</span>
              <span class="font-bold text-blue-600">${appointment.date} a las ${appointment.time}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Cliente:</span>
              <span class="font-bold text-slate-800">${appointment.clientName}</span>
            </div>
            <div class="flex justify-between pt-2 border-t border-slate-200">
              <span class="text-slate-500 font-medium">Total a pagar en local:</span>
              <span class="font-black text-sm text-slate-900">$${appointment.servicePrice}</span>
            </div>
          </div>

          <div class="mt-6 flex flex-col gap-2">
            <button id="success-done-btn" class="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all">
              Aceptar y Continuar
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('success-done-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
      this.renderCurrentView();
    });
  }

  // ==========================================
  // VISTA 3: PANEL DE DUEÑO DE NEGOCIO (DASHBOARD)
  // ==========================================
  renderOwnerDashboardView(container) {
    const businesses = storage.getBusinesses();
    const activeBizId = storage.getActiveBusinessId();
    const currentBiz = storage.getBusinessById(activeBizId) || businesses[0];
    const appointments = storage.getAppointmentsByBusiness(currentBiz.id);

    // Métricas rápidas
    const todayStr = this.getTodayDateString();
    const todayAppointments = appointments.filter(a => a.date === todayStr && a.status !== 'cancelled');
    const estimatedRevenue = appointments.filter(a => a.status === 'confirmed' || a.status === 'completed').reduce((sum, a) => sum + (a.servicePrice || 0), 0);

    container.innerHTML = `
      <div class="animate-fade-in pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <!-- Top Bar: Switch Business or Create New -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs mb-8">
          <div class="flex items-center gap-4">
            <img src="${currentBiz.image}" alt="${currentBiz.name}" class="w-14 h-14 rounded-2xl object-cover border border-slate-200">
            <div>
              <span class="text-xs font-bold text-blue-600 uppercase tracking-wider">Panel de Administración</span>
              <h1 class="text-xl font-extrabold text-slate-900">${currentBiz.name}</h1>
              <span class="text-xs text-slate-500">${currentBiz.city} • ${currentBiz.categoryLabel}</span>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <div class="flex flex-col text-right">
              <span class="text-[11px] font-bold text-slate-400 uppercase">Cambiar Negocio</span>
              <select id="switch-business-select" class="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                ${businesses.map(b => `
                  <option value="${b.id}" ${b.id === currentBiz.id ? 'selected' : ''}>${b.name}</option>
                `).join('')}
              </select>
            </div>

            <button id="open-new-biz-modal-btn" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all">
              <i class="fas fa-plus"></i> Registrar Negocio
            </button>
          </div>
        </div>

        <!-- Metric Stat Cards -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 mb-2">
              <span class="text-xs font-semibold uppercase">Citas Hoy</span>
              <i class="fas fa-calendar-day text-blue-600"></i>
            </div>
            <span class="text-2xl font-black text-slate-900">${todayAppointments.length}</span>
            <span class="text-[11px] text-slate-400 block mt-1">turnos agendados</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 mb-2">
              <span class="text-xs font-semibold uppercase">Total Reservas</span>
              <i class="fas fa-users text-indigo-600"></i>
            </div>
            <span class="text-2xl font-black text-slate-900">${appointments.length}</span>
            <span class="text-[11px] text-slate-400 block mt-1">histórico total</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 mb-2">
              <span class="text-xs font-semibold uppercase">Ingresos Est.</span>
              <i class="fas fa-dollar-sign text-emerald-600"></i>
            </div>
            <span class="text-2xl font-black text-slate-900">$${estimatedRevenue}</span>
            <span class="text-[11px] text-emerald-600 block mt-1">citas confirmadas</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 mb-2">
              <span class="text-xs font-semibold uppercase">Servicios</span>
              <i class="fas fa-list text-amber-600"></i>
            </div>
            <span class="text-2xl font-black text-slate-900">${currentBiz.services.length}</span>
            <span class="text-[11px] text-slate-400 block mt-1">activos en catálogo</span>
          </div>
        </div>

        <!-- Tabs Navigation -->
        <div class="flex items-center gap-2 border-b border-slate-200 mb-6 overflow-x-auto pb-2">
          <button class="dash-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${this.activeDashboardTab === 'appointments' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}" data-tab="appointments">
            <i class="fas fa-calendar-alt mr-1.5"></i> Agenda de Citas (${appointments.length})
          </button>
          <button class="dash-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${this.activeDashboardTab === 'services' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}" data-tab="services">
            <i class="fas fa-tag mr-1.5"></i> Servicios y Precios (${currentBiz.services.length})
          </button>
          <button class="dash-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${this.activeDashboardTab === 'schedule' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}" data-tab="schedule">
            <i class="fas fa-clock mr-1.5"></i> Horarios y Disponibilidad
          </button>
        </div>

        <!-- Dynamic Tab Content -->
        <div id="dashboard-tab-content">
          ${this.renderDashboardTabContent(currentBiz, appointments)}
        </div>
      </div>
    `;

    // Listeners del Dashboard
    document.getElementById('switch-business-select')?.addEventListener('change', (e) => {
      storage.setActiveBusinessId(e.target.value);
      this.renderCurrentView();
    });

    document.querySelectorAll('.dash-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeDashboardTab = btn.getAttribute('data-tab');
        this.renderCurrentView();
      });
    });

    document.getElementById('open-new-biz-modal-btn')?.addEventListener('click', () => {
      this.renderNewBusinessModal();
    });

    this.setupDashboardTabEvents(currentBiz);
  }

  // --- SUB-CONTENIDOS DEL DASHBOARD ---
  renderDashboardTabContent(currentBiz, appointments) {
    if (this.activeDashboardTab === 'appointments') {
      return `
        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 class="text-lg font-bold text-slate-900">Agenda y Reservas</h2>
              <p class="text-xs text-slate-500">Gestiona las reservas de tus clientes y cambia sus estados en tiempo real.</p>
            </div>

            <button id="add-manual-appointment-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all">
              <i class="fas fa-plus-circle"></i> Nueva Reserva Manual
            </button>
          </div>

          ${appointments.length === 0 ? `
            <div class="text-center py-12 text-slate-400">
              <i class="far fa-calendar-times text-4xl mb-2"></i>
              <p class="text-sm font-semibold">Aún no hay reservas registradas para este negocio.</p>
            </div>
          ` : `
            <div class="overflow-x-auto">
              <table class="w-full text-left text-xs text-slate-700">
                <thead class="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th class="py-3 px-4">Fecha / Hora</th>
                    <th class="py-3 px-4">Cliente</th>
                    <th class="py-3 px-4">Servicio</th>
                    <th class="py-3 px-4">Monto</th>
                    <th class="py-3 px-4">Estado</th>
                    <th class="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${appointments.map(apt => `
                    <tr class="hover:bg-slate-50/80 transition-colors">
                      <td class="py-3.5 px-4 font-bold text-slate-900">
                        <div>${apt.date}</div>
                        <div class="text-blue-600 text-[11px] font-mono">${apt.time} (${apt.serviceDuration}m)</div>
                      </td>
                      <td class="py-3.5 px-4">
                        <div class="font-bold text-slate-800">${apt.clientName}</div>
                        <div class="text-slate-400 text-[11px]">${apt.clientPhone}</div>
                      </td>
                      <td class="py-3.5 px-4 font-medium text-slate-700">
                        ${apt.serviceName}
                        ${apt.notes ? `<div class="text-[10px] text-slate-400 italic">"${apt.notes}"</div>` : ''}
                      </td>
                      <td class="py-3.5 px-4 font-extrabold text-slate-900">
                        $${apt.servicePrice}
                      </td>
                      <td class="py-3.5 px-4">
                        <span class="badge-status badge-status-${apt.status}">
                          ${apt.status === 'confirmed' ? 'Confirmada' : apt.status === 'pending' ? 'Pendiente' : apt.status === 'completed' ? 'Completada' : 'Cancelada'}
                        </span>
                      </td>
                      <td class="py-3.5 px-4 text-right space-x-1">
                        ${apt.status !== 'completed' ? `
                          <button class="status-change-btn p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg" data-apt-id="${apt.id}" data-status="completed" title="Marcar como completada">
                            <i class="fas fa-check"></i>
                          </button>
                        ` : ''}
                        ${apt.status !== 'cancelled' ? `
                          <button class="status-change-btn p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg" data-apt-id="${apt.id}" data-status="cancelled" title="Cancelar reserva">
                            <i class="fas fa-ban"></i>
                          </button>
                        ` : ''}
                        <button class="delete-apt-btn p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg" data-apt-id="${apt.id}" title="Eliminar registro">
                          <i class="fas fa-trash-alt"></i>
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      `;
    }

    if (this.activeDashboardTab === 'services') {
      return `
        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h2 class="text-lg font-bold text-slate-900">Catálogo de Servicios</h2>
              <p class="text-xs text-slate-500">Agrega o modifica los servicios que ofreces a tus clientes.</p>
            </div>

            <button id="add-new-service-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all">
              <i class="fas fa-plus"></i> Agregar Servicio
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${currentBiz.services.map(srv => `
              <div class="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between">
                    <h3 class="font-bold text-base text-slate-900">${srv.name}</h3>
                    <span class="text-base font-black text-blue-600">$${srv.price}</span>
                  </div>
                  <span class="inline-block mt-1 px-2.5 py-0.5 rounded-md bg-slate-200 text-slate-700 text-xs font-semibold">
                    <i class="far fa-clock mr-1"></i>${srv.duration} minutos
                  </span>
                  <p class="text-xs text-slate-500 mt-2">${srv.description || 'Sin descripción'}</p>
                </div>

                <div class="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-end gap-2">
                  <button class="delete-service-btn text-xs font-bold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors" data-service-id="${srv.id}">
                    <i class="fas fa-trash-alt mr-1"></i> Eliminar
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (this.activeDashboardTab === 'schedule') {
      const sch = currentBiz.schedule;
      const days = [
        { id: 1, name: 'Lunes' },
        { id: 2, name: 'Martes' },
        { id: 3, name: 'Miércoles' },
        { id: 4, name: 'Jueves' },
        { id: 5, name: 'Viernes' },
        { id: 6, name: 'Sábado' },
        { id: 0, name: 'Domingo' }
      ];

      return `
        <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs max-w-2xl">
          <h2 class="text-lg font-bold text-slate-900 mb-1">Configuración de Horarios y Disponibilidad</h2>
          <p class="text-xs text-slate-500 mb-6">Define los días y franjas horarias en las que tu negocio puede recibir citas.</p>

          <form id="schedule-form" class="space-y-6 text-xs sm:text-sm">
            <!-- Días laborales -->
            <div>
              <label class="block font-bold text-slate-700 mb-2 uppercase text-xs tracking-wider">Días de Atención</label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                ${days.map(d => `
                  <label class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" name="work_days" value="${d.id}" ${sch.days.includes(d.id) ? 'checked' : ''} class="rounded text-blue-600 focus:ring-blue-500">
                    <span class="font-medium text-slate-800">${d.name}</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <!-- Horarios de Apertura y Cierre -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Hora de Apertura</label>
                <input type="time" id="open-time" value="${sch.openTime}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Hora de Cierre</label>
                <input type="time" id="close-time" value="${sch.closeTime}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
            </div>

            <!-- Horario de Receso / Descanso -->
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <span class="font-bold text-slate-800 block">Receso / Almuerzo (Bloquea turnos automáticamente)</span>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-slate-500 text-xs mb-1">Inicio de descanso</label>
                  <input type="time" id="break-start" value="${sch.breakStart || ''}" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl">
                </div>
                <div>
                  <label class="block text-slate-500 text-xs mb-1">Fin de descanso</label>
                  <input type="time" id="break-end" value="${sch.breakEnd || ''}" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl">
                </div>
              </div>
            </div>

            <button type="submit" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/25 transition-all">
              Guardar Configuración de Horario
            </button>
          </form>
        </div>
      `;
    }
  }

  // --- LISTENERS ESPECÍFICOS DEL DASHBOARD ---
  setupDashboardTabEvents(currentBiz) {
    // Cambiar estado de citas
    document.querySelectorAll('.status-change-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const aptId = btn.getAttribute('data-apt-id');
        const newStatus = btn.getAttribute('data-status');
        storage.updateAppointmentStatus(aptId, newStatus);
        this.showToast(`Estado de cita actualizado a: ${newStatus}`, 'info');
        this.renderCurrentView();
      });
    });

    // Eliminar cita
    document.querySelectorAll('.delete-apt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const aptId = btn.getAttribute('data-apt-id');
        if (confirm('¿Deseas eliminar este registro de reserva?')) {
          storage.deleteAppointment(aptId);
          this.showToast('Reserva eliminada.', 'info');
          this.renderCurrentView();
        }
      });
    });

    // Abrir modal de nueva cita manual
    document.getElementById('add-manual-appointment-btn')?.addEventListener('click', () => {
      this.openBookingModal(currentBiz.id, currentBiz.services[0]?.id);
    });

    // Abrir modal de agregar servicio
    document.getElementById('add-new-service-btn')?.addEventListener('click', () => {
      this.renderNewServiceModal(currentBiz.id);
    });

    // Eliminar servicio
    document.querySelectorAll('.delete-service-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-service-id');
        if (confirm('¿Eliminar este servicio del catálogo?')) {
          storage.deleteService(currentBiz.id, sId);
          this.showToast('Servicio eliminado.', 'info');
          this.renderCurrentView();
        }
      });
    });

    // Guardar horarios
    const scheduleForm = document.getElementById('schedule-form');
    scheduleForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      const selectedDays = Array.from(document.querySelectorAll('input[name="work_days"]:checked')).map(cb => parseInt(cb.value, 10));
      const openTime = document.getElementById('open-time').value;
      const closeTime = document.getElementById('close-time').value;
      const breakStart = document.getElementById('break-start').value;
      const breakEnd = document.getElementById('break-end').value;

      currentBiz.schedule = {
        days: selectedDays,
        openTime,
        closeTime,
        breakStart: breakStart || null,
        breakEnd: breakEnd || null,
        slotDuration: currentBiz.schedule.slotDuration || 30
      };

      storage.saveBusiness(currentBiz);
      this.showToast('Horarios actualizados exitosamente.', 'success');
      this.renderCurrentView();
    });
  }

  // --- MODAL PARA AGREGAR SERVICIO ---
  renderNewServiceModal(businessId) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-slate-900">Agregar Nuevo Servicio</h3>
            <button id="close-srv-modal-btn" class="text-slate-400 hover:text-slate-600">
              <i class="fas fa-times text-lg"></i>
            </button>
          </div>

          <form id="new-service-form" class="space-y-4 text-xs sm:text-sm">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Nombre del Servicio *</label>
              <input type="text" id="srv-name" required placeholder="Ej. Limpieza Facial Profunda" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Precio ($) *</label>
                <input type="number" id="srv-price" required min="0" step="1" placeholder="Ej. 250" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Duración (min) *</label>
                <select id="srv-duration" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                  <option value="15">15 min</option>
                  <option value="30" selected>30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">60 min (1 hr)</option>
                  <option value="90">90 min (1.5 hrs)</option>
                  <option value="120">120 min (2 hrs)</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Descripción</label>
              <textarea id="srv-desc" rows="2" placeholder="Detalles de lo que incluye el servicio..." class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl"></textarea>
            </div>

            <button type="submit" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all">
              Crear Servicio
            </button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-srv-modal-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    document.getElementById('new-service-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('srv-name').value;
      const price = document.getElementById('srv-price').value;
      const duration = document.getElementById('srv-duration').value;
      const description = document.getElementById('srv-desc').value;

      storage.addService(businessId, { name, price, duration, description });
      this.showToast('Servicio agregado al catálogo.', 'success');
      modalContainer.innerHTML = '';
      this.renderCurrentView();
    });
  }

  // --- MODAL PARA REGISTRAR NUEVO NEGOCIO ---
  renderNewBusinessModal() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 p-6 my-8">
          <div class="flex items-center justify-between mb-4">
            <div>
              <span class="text-xs font-bold text-blue-600 uppercase">Onboarding</span>
              <h3 class="text-xl font-bold text-slate-900">Registrar Nuevo Negocio</h3>
            </div>
            <button id="close-biz-modal-btn" class="text-slate-400 hover:text-slate-600">
              <i class="fas fa-times text-lg"></i>
            </button>
          </div>

          <form id="new-biz-form" class="space-y-4 text-xs sm:text-sm">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Nombre del Negocio *</label>
              <input type="text" id="new-biz-name" required placeholder="Ej. Spa & Relax Oasis" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Categoría *</label>
                <select id="new-biz-cat" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                  <option value="belleza">Belleza y Barbería</option>
                  <option value="salud">Salud y Bienestar</option>
                  <option value="spa">Spa y Masajes</option>
                  <option value="fitness">Fitness y Deporte</option>
                  <option value="autos">Talleres y Autos</option>
                  <option value="fotografia">Fotografía y Eventos</option>
                </select>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Ciudad *</label>
                <input type="text" id="new-biz-city" required placeholder="Ej. Ciudad de México" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Teléfono / WhatsApp *</label>
                <input type="tel" id="new-biz-phone" required placeholder="+52 55 1234 5678" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Correo Electrónico</label>
                <input type="email" id="new-biz-email" placeholder="contacto@negocio.com" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Dirección Física</label>
              <input type="text" id="new-biz-address" placeholder="Calle, Número, Colonia" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Descripción del Negocio</label>
              <textarea id="new-biz-desc" rows="2" placeholder="Describe brevemente tus especialidades..." class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl"></textarea>
            </div>

            <button type="submit" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/25 transition-all">
              Registrar y Configurar
            </button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-biz-modal-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    document.getElementById('new-biz-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('new-biz-name').value;
      const category = document.getElementById('new-biz-cat').value;
      const city = document.getElementById('new-biz-city').value;
      const phone = document.getElementById('new-biz-phone').value;
      const email = document.getElementById('new-biz-email').value;
      const address = document.getElementById('new-biz-address').value;
      const description = document.getElementById('new-biz-desc').value;

      const catLabels = {
        belleza: 'Belleza y Barbería',
        salud: 'Salud y Bienestar',
        spa: 'Spa y Masajes',
        fitness: 'Fitness y Deporte',
        autos: 'Talleres y Autos',
        fotografia: 'Fotografía y Eventos'
      };

      const newId = `biz-${Date.now()}`;
      storage.saveBusiness({
        id: newId,
        name,
        category,
        categoryLabel: catLabels[category] || 'Servicios',
        city,
        phone,
        email,
        address,
        description,
        image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
        coverImage: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
        services: [
          { id: `srv-${Date.now()}-1`, name: 'Servicio Inicial Estándar', duration: 30, price: 150, description: 'Servicio principal del establecimiento.' }
        ]
      });

      storage.setActiveBusinessId(newId);
      this.showToast('¡Negocio registrado exitosamente!', 'success');
      modalContainer.innerHTML = '';
      this.renderCurrentView();
    });
  }

  // --- EVENTOS GLOBALES ---
  setupGlobalEvents() {
    // Cerrar modales con Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeBookingModal();
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) modalContainer.innerHTML = '';
      }
    });
  }
}

// Inicializar la aplicación cuando cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});

