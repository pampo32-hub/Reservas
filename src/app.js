// Controlador principal de la aplicación (TurnoYa - Directorio & Reservas)
import { storage } from './services/storage.js';

class App {
  constructor() {
    this.currentView = 'directory'; // 'directory' | 'business-detail' | 'owner-dashboard' | 'my-client-bookings' | 'developer-dashboard'
    this.selectedBusinessId = null;
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.logoClickCount = 0;
    this.logoClickTimer = null;
    
    // Filtros de citas
    this.ownerAppointmentFilter = 'all'; // 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'
    this.clientAppointmentFilter = 'all'; // 'all' | 'active' | 'completed' | 'cancelled'

    // Estado del modal de reserva
    this.bookingState = {
      isOpen: false,
      businessId: null,
      serviceId: null,
      selectedDate: this.getTodayDateString(),
      selectedTime: null
    };

    // Estado del panel de dueño
    this.activeDashboardTab = 'appointments'; // 'appointments' | 'services' | 'profile' | 'schedule'

    // Estado del panel de developer
    this.activeDevTab = 'alerts'; // 'alerts' | 'businesses' | 'clients' | 'appointments'
    this.devSearchQuery = '';
    this.devBizFilter = 'all'; // 'all' | 'active' | 'hidden' | 'blocked' | 'real' | 'demo'
  }

  getTodayDateString() {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  formatColones(amount) {
    const num = Number(amount) || 0;
    return '₡' + num.toLocaleString('es-CR', { maximumFractionDigits: 0 });
  }

  formatTime12h(timeStr) {
    if (!timeStr) return '';
    const clean = String(timeStr).trim();
    if (clean.includes('AM') || clean.includes('PM') || clean.includes('am') || clean.includes('pm')) {
      return clean;
    }
    const parts = clean.split(':');
    if (parts.length < 2) return clean;
    let hour = parseInt(parts[0], 10);
    const minute = parts[1].padStart(2, '0');
    if (isNaN(hour)) return clean;
    const period = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute} ${period}`;
  }

  formatDateDMY(dateStr) {
    if (!dateStr) return '';
    const clean = String(dateStr).trim();
    if (clean.includes('/')) return clean;
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    }
    return clean;
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

  // --- HEADER / NAVBAR (ACCESO USUARIOS Y NEGOCIOS) ---
  // --- HEADER / NAVBAR ---
  renderHeader() {
    const headerContainer = document.getElementById('navbar-container');
    if (!headerContainer) return;

    const devUser = storage.getDeveloperUser();
    const bizUser = storage.getBusinessUser();
    const clientUser = storage.getClientUser();
    const activeBiz = bizUser ? storage.getBusinessById(bizUser.businessId) : null;

    headerContainer.innerHTML = `
      <header class="sticky top-0 z-40 glass-header border-b border-slate-200/80 shadow-xs">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-2">
          <!-- Logo (con acceso secreto 3 clics para Developer) -->
          <div class="flex items-center gap-3 cursor-pointer select-none" id="nav-logo-btn" title="TurnoYa Costa Rica (Triple clic: Acceso Developer)">
            <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <i class="fas fa-calendar-check text-xl"></i>
            </div>
            <div>
              <span class="font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">TurnoYa</span>
              <span class="text-xs block text-slate-500 font-medium hidden sm:block">Directorio & Reservas Costa Rica 🇨🇷</span>
            </div>
          </div>

          <!-- Navigation / Auth Controls -->
          <div class="flex items-center gap-2 sm:gap-3">
            <!-- Explorar -->
            <button id="nav-directory-btn" class="px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${this.currentView === 'directory' || this.currentView === 'business-detail' ? 'bg-blue-50 text-blue-700 shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
              <i class="fas fa-compass mr-1"></i> Explorar
            </button>

            <!-- 0. SI EL DEVELOPER ESTÁ LOGUEADO -->
            ${devUser ? `
              <div class="flex items-center gap-1 bg-slate-900 text-white p-1 rounded-xl border border-slate-700 shadow-md animate-fade-in">
                <button id="nav-dev-dashboard-btn" class="px-3 py-1.5 rounded-lg text-xs font-black tracking-wide flex items-center gap-1.5 transition-all ${this.currentView === 'developer-dashboard' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-amber-400 hover:bg-slate-800'}">
                  <i class="fas fa-shield-alt text-xs"></i>
                  <span>DEVELOPER</span>
                </button>
                <button id="nav-dev-logout-btn" class="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg transition-colors" title="Cerrar sesión de Developer">
                  <i class="fas fa-sign-out-alt text-xs"></i>
                </button>
              </div>
            ` : ''}

            <!-- 1. SI EL CLIENTE ESTÁ LOGUEADO -->
            ${clientUser && !devUser ? `
              <div class="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button id="nav-client-bookings-btn" class="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-800 hover:bg-white transition-all flex items-center gap-1.5 ${this.currentView === 'my-client-bookings' ? 'bg-white shadow-xs text-blue-600' : ''}">
                  <i class="fas fa-user-circle text-blue-600 text-sm"></i>
                  <span class="max-w-[100px] truncate">${clientUser.name ? clientUser.name.split(' ')[0] : 'Mi Perfil'}</span>
                  <span class="hidden md:inline text-[10px] text-slate-400">(Mis Citas)</span>
                </button>
                <button id="nav-client-logout-btn" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg" title="Cerrar sesión de cliente">
                  <i class="fas fa-sign-out-alt text-xs"></i>
                </button>
              </div>
            ` : ''}

            <!-- 2. SI EL NEGOCIO ESTÁ LOGUEADO -->
            ${bizUser && !devUser ? `
              <div class="flex items-center gap-1 bg-indigo-50 border border-indigo-100 p-1 rounded-xl">
                <button id="nav-biz-dashboard-btn" class="px-3.5 py-1.5 rounded-lg text-xs font-bold text-indigo-900 hover:bg-white transition-all flex items-center gap-1.5 ${this.currentView === 'owner-dashboard' ? 'bg-indigo-600 text-white shadow-xs' : ''}">
                  <i class="fas fa-store text-xs ${this.currentView === 'owner-dashboard' ? 'text-white' : 'text-indigo-600'}"></i>
                  <span class="max-w-[120px] truncate">${activeBiz ? activeBiz.name : 'Mi Negocio'}</span>
                </button>
                <button id="nav-biz-logout-btn" class="p-1.5 text-indigo-400 hover:text-rose-600 rounded-lg" title="Cerrar sesión de negocio">
                  <i class="fas fa-sign-out-alt text-xs"></i>
                </button>
              </div>
            ` : ''}

            <!-- 3. BOTONES INICIAR SESIÓN Y REGISTRARSE (CUANDO NO HAY SESIÓN ACTIVA) -->
            ${!clientUser && !bizUser && !devUser ? `
              <button id="nav-login-btn" class="px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 shadow-xs flex items-center gap-1.5 transition-all">
                <i class="fas fa-sign-in-alt text-blue-600"></i>
                <span>Iniciar Sesión</span>
              </button>

              <button id="nav-register-btn" class="px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition-all">
                <i class="fas fa-user-plus"></i>
                <span>Registrarse</span>
              </button>
            ` : ''}

            <!-- Acceso adicional si cliente logueado quiere entrar como negocio -->
            ${clientUser && !bizUser && !devUser ? `
              <button id="nav-biz-extra-btn" class="px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 hidden sm:flex items-center gap-1.5 transition-all" title="Acceso al panel de negocio">
                <i class="fas fa-store text-indigo-600"></i>
                <span>Soy Negocio</span>
              </button>
            ` : ''}
          </div>
        </div>
      </header>
    `;

    // Eventos de Navegación y Auth
    document.getElementById('nav-logo-btn')?.addEventListener('click', () => {
      this.logoClickCount++;
      clearTimeout(this.logoClickTimer);
      this.logoClickTimer = setTimeout(() => {
        this.logoClickCount = 0;
      }, 700);

      if (this.logoClickCount >= 3) {
        this.logoClickCount = 0;
        this.renderDeveloperQuickLoginModal();
        return;
      }
      this.navigateTo('directory');
    });

    document.getElementById('nav-directory-btn')?.addEventListener('click', () => this.navigateTo('directory'));

    // Developer logueado
    document.getElementById('nav-dev-dashboard-btn')?.addEventListener('click', () => this.navigateTo('developer-dashboard'));
    document.getElementById('nav-dev-logout-btn')?.addEventListener('click', () => {
      storage.logoutDeveloper();
      this.showToast('Sesión de Developer cerrada.', 'info');
      this.renderHeader();
      if (this.currentView === 'developer-dashboard') this.navigateTo('directory');
    });

    // Botones Iniciar Sesión y Registrarse
    document.getElementById('nav-login-btn')?.addEventListener('click', () => this.renderAuthModal({ mode: 'login', role: 'client' }));
    document.getElementById('nav-register-btn')?.addEventListener('click', () => this.renderAuthModal({ mode: 'register', role: 'client' }));
    document.getElementById('nav-biz-extra-btn')?.addEventListener('click', () => this.renderAuthModal({ mode: 'login', role: 'business' }));

    // Cliente logueado
    document.getElementById('nav-client-bookings-btn')?.addEventListener('click', () => this.navigateTo('my-client-bookings'));
    document.getElementById('nav-client-logout-btn')?.addEventListener('click', () => {
      storage.logoutClient();
      this.showToast('Sesión de usuario cerrada.', 'info');
      this.renderHeader();
      if (this.currentView === 'my-client-bookings') this.navigateTo('directory');
    });

    // Negocio logueado
    document.getElementById('nav-biz-dashboard-btn')?.addEventListener('click', () => this.navigateTo('owner-dashboard'));
    document.getElementById('nav-biz-logout-btn')?.addEventListener('click', () => {
      storage.logoutBusiness();
      this.showToast('Sesión de negocio cerrada.', 'info');
      this.renderHeader();
      if (this.currentView === 'owner-dashboard') this.navigateTo('directory');
    });
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
      case 'my-client-bookings':
        this.renderClientBookingsView(main);
        break;
      case 'developer-dashboard':
        this.renderDeveloperDashboardView(main);
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
    let businesses = storage.getBusinesses().filter(b => !b.isHidden && !b.isBlocked);

    if (this.selectedCategory !== 'all') {
      businesses = businesses.filter(b => b.category === this.selectedCategory);
    }
    if (this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase();
      businesses = businesses.filter(b => 
        b.name.toLowerCase().includes(q) ||
        b.description?.toLowerCase().includes(q) ||
        b.city?.toLowerCase().includes(q) ||
        (b.services && b.services.some(s => s.name.toLowerCase().includes(q)))
      );
    }

    container.innerHTML = `
      <div class="animate-fade-in pb-20">
        <!-- Hero Section -->
        <section class="relative bg-gradient-to-b from-blue-50/70 via-white to-slate-50 border-b border-slate-200/70 py-16 px-4 sm:px-6 lg:px-8">
          <div class="max-w-4xl mx-auto text-center">
            <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/80 text-blue-700 text-xs font-bold uppercase tracking-wider mb-4">
              <i class="fas fa-bolt text-blue-600"></i> Reserva tu turno en línea en Costa Rica
            </span>
            <h1 class="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Encuentra los mejores comercios y <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">agenda tu cita al instante</span>
            </h1>
            <p class="mt-4 text-slate-600 text-base sm:text-lg max-w-2xl mx-auto">
              Barberías, spas, dentistas, talleres mecánicos y más. Selecciona tu horario ideal sin llamadas.
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
                placeholder="Busca por servicio ('corte', 'masaje', 'dentista', 'frenos') o cantón..." 
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
                <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group hover:-translate-y-1 relative">
                  <!-- Image Header -->
                  <div class="relative h-52 overflow-hidden bg-slate-100">
                    <img src="${biz.image || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80'}" alt="${biz.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30"></div>
                    
                    <!-- Badge COMERCIO DE MUESTRA o REGISTRADO -->
                    <div class="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                      ${biz.isDemo ? `
                        <span class="bg-purple-700/90 text-white backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 shadow-md border border-purple-400/40">
                          <i class="fas fa-flask text-purple-200"></i> Comercio de Muestra
                        </span>
                      ` : `
                        <span class="bg-emerald-600/90 text-white backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 shadow-md">
                          <i class="fas fa-check-circle text-emerald-200"></i> Comercio Registrado
                        </span>
                      `}
                      <span class="bg-white/95 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[11px] font-bold text-slate-800 shadow-sm">
                        ${biz.categoryLabel}
                      </span>
                    </div>

                    <!-- Rating -->
                    <span class="absolute top-3 right-3 bg-amber-400 text-slate-900 px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1 shadow-sm">
                      <i class="fas fa-star text-xs"></i> ${biz.rating || 5.0} <span class="text-slate-700 font-normal">(${biz.reviewsCount || 0})</span>
                    </span>

                    <div class="absolute bottom-3 left-3 right-3 text-white">
                      <span class="text-xs font-semibold text-slate-200 flex items-center gap-1">
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
                        ${biz.description || ''}
                      </p>

                      <!-- Features pills preview -->
                      ${biz.features && biz.features.length > 0 ? `
                        <div class="flex flex-wrap gap-1.5 mt-3">
                          ${biz.features.slice(0, 3).map(feat => `
                            <span class="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                              ${feat}
                            </span>
                          `).join('')}
                          ${biz.features.length > 3 ? `<span class="text-[10px] text-slate-400">+${biz.features.length - 3}</span>` : ''}
                        </div>
                      ` : ''}

                      <!-- Schedule info -->
                      <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                        <span class="flex items-center gap-1.5 font-medium">
                          <i class="far fa-clock text-blue-600"></i> 
                          ${biz.schedule ? `${this.formatTime12h(biz.schedule.openTime)} - ${this.formatTime12h(biz.schedule.closeTime)}` : '8:00 AM - 6:00 PM'}
                        </span>
                        <span class="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                          ${biz.services ? biz.services.length : 0} servicios
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

    document.querySelectorAll('.category-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedCategory = btn.getAttribute('data-category-id');
        this.renderCurrentView();
      });
    });

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
    const activeDaysText = biz.schedule && biz.schedule.days ? biz.schedule.days.map(d => dayNames[d]).join(', ') : 'Lunes a Sábado';

    container.innerHTML = `
      <div class="animate-fade-in pb-20">
        <!-- Cover Banner Hero -->
        <div class="relative bg-slate-900 h-64 sm:h-96 w-full overflow-hidden">
          <img src="${biz.coverImage || biz.image}" alt="${biz.name}" class="w-full h-full object-cover opacity-60">
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent"></div>

          <div class="absolute top-6 left-4 sm:left-8 z-10">
            <button id="back-to-directory-btn" class="px-4 py-2 rounded-xl bg-white/90 hover:bg-white text-slate-800 text-sm font-bold flex items-center gap-2 shadow-lg backdrop-blur-md transition-all">
              <i class="fas fa-arrow-left"></i> Volver al Directorio
            </button>
          </div>

          <div class="absolute bottom-6 left-4 sm:left-8 right-4 sm:right-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 text-white">
            <div class="space-y-2">
              <div class="flex flex-wrap items-center gap-2">
                ${biz.isBlocked ? `
                  <span class="px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-black uppercase tracking-wider shadow-md">
                    <i class="fas fa-ban mr-1"></i> Comercio Suspendido
                  </span>
                ` : biz.isHidden ? `
                  <span class="px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider shadow-md">
                    <i class="fas fa-eye-slash mr-1"></i> Oculto de Inicio
                  </span>
                ` : biz.isDemo ? `
                  <span class="px-3 py-1 rounded-full bg-purple-600 text-white text-xs font-black uppercase tracking-wider shadow-md">
                    <i class="fas fa-flask mr-1"></i> Comercio de Muestra
                  </span>
                ` : `
                  <span class="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-black uppercase tracking-wider shadow-md">
                    <i class="fas fa-check-circle mr-1"></i> Comercio Registrado
                  </span>
                `}
                <span class="px-3 py-1 rounded-full bg-blue-600 text-white text-xs font-bold uppercase tracking-wider">
                  ${biz.categoryLabel}
                </span>
                <span class="bg-amber-400 text-slate-900 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <i class="fas fa-star text-xs"></i> ${biz.rating || 5.0} (${biz.reviewsCount || 0} opiniones)
                </span>
              </div>
              <h1 class="text-2xl sm:text-4xl font-extrabold tracking-tight">${biz.name}</h1>
              <p class="text-sm text-slate-300 flex items-center gap-1.5">
                <i class="fas fa-map-marker-alt text-rose-400"></i> ${biz.address}, ${biz.city}
              </p>
            </div>
          </div>
        </div>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Columna Izquierda: Servicios y Catálogo (2 cols) -->
          <div class="lg:col-span-2 space-y-6">
            ${biz.isBlocked ? `
              <div class="p-5 bg-rose-50 border border-rose-200 rounded-3xl flex items-center gap-4 text-rose-900 shadow-sm animate-fade-in">
                <div class="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center text-xl flex-shrink-0">
                  <i class="fas fa-ban"></i>
                </div>
                <div>
                  <h3 class="font-extrabold text-base text-rose-950">Comercio Suspendido Temporalmente</h3>
                  <p class="text-xs text-rose-700 mt-0.5">${biz.blockReason || 'Este comercio no está admitiendo reservas en este momento por disposición de la administración.'}</p>
                </div>
              </div>
            ` : ''}

            <!-- Servicios -->
            <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
              <h2 class="text-xl font-bold text-slate-900 mb-2">Servicios Disponibles</h2>
              <p class="text-sm text-slate-500 mb-6">Selecciona el servicio que deseas para ver turnos disponibles y agendar.</p>

              <div class="space-y-4">
                ${biz.services && biz.services.length > 0 ? biz.services.map(srv => `
                  <div class="p-5 rounded-2xl border border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div class="flex-1">
                      <div class="flex items-center gap-3">
                        <h3 class="font-bold text-base text-slate-900">${srv.name}</h3>
                        <span class="px-2.5 py-0.5 rounded-full bg-slate-200/80 text-slate-700 text-xs font-semibold">
                          <i class="far fa-clock mr-1 text-slate-500"></i>${srv.duration} min
                        </span>
                      </div>
                      <p class="text-xs text-slate-500 mt-1.5">${srv.description || 'Sin descripción detallada'}</p>
                    </div>

                    <div class="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-3">
                      <span class="text-lg font-extrabold text-blue-600">${this.formatColones(srv.price)}</span>
                      ${biz.isBlocked ? `
                        <button disabled class="px-4 py-2.5 rounded-xl bg-slate-200 text-slate-400 text-xs font-bold cursor-not-allowed flex items-center gap-1.5">
                          <i class="fas fa-lock"></i> Suspendido
                        </button>
                      ` : `
                        <button 
                          class="book-service-btn px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5"
                          data-service-id="${srv.id}"
                        >
                          <i class="fas fa-calendar-plus"></i> Reservar
                        </button>
                      `}
                    </div>
                  </div>
                `).join('') : `
                  <p class="text-sm text-slate-400 py-4">Este comercio aún no tiene servicios agregados.</p>
                `}
              </div>
            </div>

            <!-- Características y Amenidades -->
            ${biz.features && biz.features.length > 0 ? `
              <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
                <h2 class="text-lg font-bold text-slate-900 mb-4">Comodidades y Métodos de Pago</h2>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  ${biz.features.map(feat => `
                    <div class="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
                      <i class="fas fa-check text-emerald-600 text-sm"></i>
                      <span>${feat}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Sobre Nosotros -->
            <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs">
              <h2 class="text-lg font-bold text-slate-900 mb-3">Sobre el Establecimiento</h2>
              <p class="text-sm text-slate-600 leading-relaxed">${biz.description || 'Sin descripción registrada.'}</p>
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
                  <span class="truncate">${biz.email || 'No especificado'}</span>
                </div>

                <div class="flex items-center gap-3 text-slate-600">
                  <div class="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                    <i class="fas fa-map-pin text-xs"></i>
                  </div>
                  <span>${biz.address}</span>
                </div>
              </div>

              ${biz.phone ? `
                <div class="pt-4 border-t border-slate-100">
                  <a href="https://wa.me/${biz.phone.replace(/[^0-9]/g, '')}" target="_blank" class="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors">
                    <i class="fab fa-whatsapp text-sm"></i> Chatear por WhatsApp
                  </a>
                </div>
              ` : ''}
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
                  <span class="font-medium">Horario de atención:</span>
                  <span class="font-bold text-slate-800">${biz.schedule ? `${this.formatTime12h(biz.schedule.openTime)} - ${this.formatTime12h(biz.schedule.closeTime)}` : '8:00 AM - 6:00 PM'}</span>
                </div>
                ${biz.schedule && biz.schedule.breakStart ? `
                  <div class="flex justify-between py-1.5 text-amber-700 bg-amber-50 px-2 rounded-lg">
                    <span class="font-medium">Receso / Almuerzo:</span>
                    <span class="font-bold">${this.formatTime12h(biz.schedule.breakStart)} - ${this.formatTime12h(biz.schedule.breakEnd)}</span>
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
  // MODAL DE RESERVA EN TIEMPO REAL (FLUJO CLIENTE)
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
    const service = biz?.services?.find(s => s.id === this.bookingState.serviceId) || biz?.services?.[0];
    if (!biz || !service) return;

    const availability = storage.getAvailableSlots(biz.id, this.bookingState.selectedDate, service.duration);
    const clientUser = storage.getClientUser();

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
                <span class="text-lg font-black text-blue-700">${this.formatColones(service.price)}</span>
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
                      ${this.formatTime12h(slot)}
                    </button>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- Paso 3: Identificación / Datos del Cliente (Sencillo) -->
            <form id="booking-form" class="space-y-3 pt-3 border-t border-slate-100">
              <div class="flex items-center justify-between">
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  3. Tus Datos para la Reserva
                </label>
                ${clientUser ? `
                  <span class="text-[11px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                    <i class="fas fa-check-circle mr-1"></i> Sesión activa
                  </span>
                ` : `
                  <span class="text-[11px] text-slate-400">Sin contraseñas complicadas</span>
                `}
              </div>

              <div>
                <input 
                  type="text" 
                  id="client-name" 
                  value="${clientUser ? clientUser.name : ''}"
                  placeholder="Nombre y Apellidos *" 
                  required 
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input 
                  type="tel" 
                  id="client-phone" 
                  value="${clientUser ? clientUser.phone : ''}"
                  placeholder="Teléfono / WhatsApp (+506) *" 
                  required 
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <input 
                  type="email" 
                  id="client-email" 
                  value="${clientUser ? clientUser.email || '' : ''}"
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

              <!-- Consentimiento previo (Opt-in) Notificaciones WhatsApp -->
              <div class="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl">
                <label class="flex items-start gap-3 cursor-pointer select-none">
                  <input type="checkbox" id="client-whatsapp-optin" checked class="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-emerald-300">
                  <div class="text-xs text-slate-700 leading-snug">
                    <div class="font-bold text-emerald-800 flex items-center gap-1.5 mb-0.5">
                      <i class="fab fa-whatsapp text-emerald-600 text-sm"></i>
                      <span>Confirmación de Reserva por WhatsApp</span>
                    </div>
                    <p class="text-slate-600 text-[11px]">
                      Acepto recibir el mensaje de confirmación de esta reserva y recordatorios del turno por WhatsApp a mi número de teléfono.
                    </p>
                  </div>
                </label>
              </div>

              <!-- Submit button -->
              <button 
                type="submit" 
                id="submit-booking-btn"
                ${!this.bookingState.selectedTime ? 'disabled' : ''}
                class="w-full mt-4 py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
              >
                <i class="fas fa-check-circle"></i>
                <span>Confirmar Reserva ${this.bookingState.selectedTime ? `(${this.formatTime12h(this.bookingState.selectedTime)})` : ''}</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

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

    const form = document.getElementById('booking-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!this.bookingState.selectedTime) {
        this.showToast('Por favor selecciona una hora disponible.', 'error');
        return;
      }

      const clientName = document.getElementById('client-name').value;
      const clientPhone = document.getElementById('client-phone').value;
      const clientEmail = document.getElementById('client-email').value;
      const clientNotes = document.getElementById('client-notes').value;
      const whatsappOptIn = document.getElementById('client-whatsapp-optin')?.checked ?? true;

      // Guardar o actualizar sesión de cliente
      await storage.loginOrRegisterClient(clientName, clientPhone, clientEmail, whatsappOptIn);
      this.renderHeader();

      const newAppointment = await storage.createAppointment({
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
        whatsappOptIn,
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
              <span class="font-bold text-blue-600">${appointment.date} a las ${this.formatTime12h(appointment.time)}</span>
              <span class="font-bold text-blue-600">${this.formatDateDMY(appointment.date)} a las ${this.formatTime12h(appointment.time)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Cliente:</span>
              <span class="font-bold text-slate-800">${appointment.clientName}</span>
            </div>
            <div class="flex justify-between pt-2 border-t border-slate-200">
              <span class="text-slate-500 font-medium">Total a pagar en local:</span>
              <span class="font-black text-sm text-slate-900">${this.formatColones(appointment.servicePrice)}</span>
            </div>
          </div>

          ${appointment.whatsappOptIn !== false ? `
            <div class="mt-4 p-3 bg-emerald-50/90 rounded-2xl border border-emerald-200 flex items-center gap-3 text-xs text-emerald-800 font-medium text-left animate-fade-in">
              <div class="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 text-base shadow-sm">
                <i class="fab fa-whatsapp"></i>
              </div>
              <div>
                <strong class="block text-emerald-950 font-bold text-[11px] uppercase tracking-wider">Confirmación WhatsApp enviada</strong>
                <span class="text-[11px] text-emerald-700">Se enviará el comprobante y recordatorios a tu número <strong>${appointment.clientPhone}</strong>.</span>
              </div>
            </div>
          ` : ''}

          <div class="mt-6 flex flex-col gap-2">
            <button id="success-view-bookings-btn" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20">
              Ver Mis Reservas
            </button>
            <button id="success-done-btn" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all">
              Seguir Explorando
            </button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('success-view-bookings-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
      this.navigateTo('my-client-bookings');
    });

    document.getElementById('success-done-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
      this.renderCurrentView();
    });
  }

  // ==========================================
  // MODAL DE REPROGRAMACIÓN / EDICIÓN DE CITAS
  // ==========================================
  renderRescheduleModal(appointment, isOwnerMode = false) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer || !appointment) return;

    const biz = storage.getBusinessById(appointment.businessId);
    if (!biz) {
      this.showToast('No se encontró el negocio asociado a esta cita.', 'error');
      return;
    }

    let selectedServiceId = appointment.serviceId || (biz.services && biz.services[0]?.id);
    let selectedDate = appointment.date || this.getTodayDateString();
    let selectedTime = appointment.time;
    let currentService = biz.services?.find(s => s.id === selectedServiceId) || {
      id: appointment.serviceId,
      name: appointment.serviceName,
      price: appointment.servicePrice,
      duration: appointment.serviceDuration || 30
    };

    const renderModalContent = () => {
      currentService = biz.services?.find(s => s.id === selectedServiceId) || currentService;
      const duration = currentService?.duration || 30;
      const availability = storage.getAvailableSlots(biz.id, selectedDate, duration, appointment.id);

      modalContainer.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in overflow-y-auto">
          <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-8">
            <!-- Header -->
            <div class="bg-gradient-to-r ${isOwnerMode ? 'from-indigo-700 to-blue-700' : 'from-blue-600 to-indigo-600'} p-6 text-white flex items-center justify-between">
              <div>
                <span class="text-xs uppercase tracking-wider text-blue-200 font-bold">
                  <i class="fas ${isOwnerMode ? 'fa-user-cog' : 'fa-calendar-alt'} mr-1"></i>
                  ${isOwnerMode ? 'Panel de Negocio: Modificar Cita' : 'Reprogramar mi Turno'}
                </span>
                <h3 class="text-xl font-black mt-0.5">${biz.name}</h3>
                <span class="text-xs text-blue-100 font-mono">CÓDIGO CITA: #${appointment.id.toUpperCase()}</span>
              </div>
              <button id="close-reschedule-modal-btn" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- Body -->
            <form id="reschedule-form" class="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <!-- Info Actual -->
              <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span class="text-[10px] uppercase font-bold text-slate-400 block">Horario Registrado</span>
                  <span class="font-bold text-slate-700"><i class="far fa-calendar mr-1 text-blue-600"></i>${appointment.date}</span>
                  <span class="font-bold text-slate-700"><i class="far fa-calendar mr-1 text-blue-600"></i>${this.formatDateDMY(appointment.date)}</span>
                  <span class="font-bold text-slate-700 ml-2"><i class="far fa-clock mr-1 text-blue-600"></i>${this.formatTime12h(appointment.time)}</span>
                </div>
                <div class="text-right">
                  <span class="text-[10px] uppercase font-bold text-slate-400 block">Estado</span>
                  <span class="badge-status badge-status-${appointment.status}">${appointment.status === 'confirmed' ? 'Confirmada' : appointment.status === 'pending' ? 'Pendiente' : appointment.status === 'completed' ? 'Completada' : 'Cancelada'}</span>
                </div>
              </div>

              <!-- Selector de Servicio -->
              ${biz.services && biz.services.length > 0 ? `
                <div>
                  <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Servicio
                  </label>
                  <select id="reschedule-service-select" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    ${biz.services.map(s => `
                      <option value="${s.id}" ${s.id === selectedServiceId ? 'selected' : ''}>
                        ${s.name} - ${this.formatColones(s.price)} (${s.duration} min)
                      </option>
                    `).join('')}
                  </select>
                </div>
              ` : ''}

              <!-- 1. Nueva Fecha -->
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  1. Seleccionar Fecha
                </label>
                <input 
                  type="date" 
                  id="reschedule-date-input" 
                  value="${selectedDate}" 
                  min="${this.getTodayDateString()}" 
                  required
                  class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <!-- 2. Horarios Disponibles -->
              <div>
                <div class="flex items-center justify-between mb-1.5">
                  <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    2. Seleccionar Horario (${availability.slots ? availability.slots.length : 0} disponibles)
                  </label>
                  ${selectedTime ? `
                    <span class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                      Seleccionado: ${this.formatTime12h(selectedTime)}
                    </span>
                  ` : ''}
                </div>

                ${availability.isClosed ? `
                  <div class="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs flex items-center gap-2">
                    <i class="fas fa-calendar-times text-base"></i>
                    <span>${availability.reason}</span>
                  </div>
                ` : availability.slots.length === 0 ? `
                  <div class="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-center gap-2">
                    <i class="fas fa-info-circle text-base"></i>
                    <span>No hay horarios disponibles en esta fecha. Por favor elige otro día.</span>
                  </div>
                ` : `
                  <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1 bg-slate-50 rounded-2xl border border-slate-200">
                    ${availability.slots.map(slot => `
                      <button 
                        type="button" 
                        class="reschedule-slot-btn py-2 px-2 text-xs font-bold rounded-xl border transition-all ${selectedTime === slot ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50'}"
                        data-slot="${slot}"
                      >
                        ${this.formatTime12h(slot)}
                      </button>
                    `).join('')}
                  </div>
                `}
              </div>

              <!-- Opciones adicionales para Dueño de Negocio -->
              ${isOwnerMode ? `
                <div class="pt-3 border-t border-slate-200 space-y-3">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-bold text-slate-700 mb-1">Nombre del Cliente</label>
                      <input type="text" id="reschedule-client-name" value="${appointment.clientName || ''}" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium">
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-slate-700 mb-1">Teléfono / WhatsApp</label>
                      <input type="tel" id="reschedule-client-phone" value="${appointment.clientPhone || ''}" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium">
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1">Estado de la Reserva</label>
                    <select id="reschedule-status-select" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">
                      <option value="confirmed" ${appointment.status === 'confirmed' ? 'selected' : ''}>✅ Confirmada / Aceptada</option>
                      <option value="pending" ${appointment.status === 'pending' ? 'selected' : ''}>⏳ Pendiente de Confirmación</option>
                      <option value="completed" ${appointment.status === 'completed' ? 'selected' : ''}>🎉 Completada / Atendida</option>
                      <option value="cancelled" ${appointment.status === 'cancelled' ? 'selected' : ''}>❌ Cancelada</option>
                    </select>
                  </div>
                </div>
              ` : ''}

              <!-- Notas adicionales -->
              <div>
                <label class="block text-xs font-bold text-slate-700 mb-1">
                  Notas o Solicitudes Especiales
                </label>
                <textarea id="reschedule-notes-input" rows="2" placeholder="Ej: Confirmar si llego 5 minutos tarde..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">${appointment.notes || ''}</textarea>
              </div>

              <!-- Botones de Acción -->
              <div class="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button type="button" id="cancel-reschedule-btn" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors">
                  Cerrar
                </button>
                <button type="submit" id="save-reschedule-btn" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5">
                  <i class="fas fa-check-circle"></i> Guardar y Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      `;

      // Eventos del Modal
      document.getElementById('close-reschedule-modal-btn')?.addEventListener('click', () => {
        modalContainer.innerHTML = '';
      });
      document.getElementById('cancel-reschedule-btn')?.addEventListener('click', () => {
        modalContainer.innerHTML = '';
      });

      document.getElementById('reschedule-service-select')?.addEventListener('change', (e) => {
        selectedServiceId = e.target.value;
        renderModalContent();
      });

      document.getElementById('reschedule-date-input')?.addEventListener('change', (e) => {
        selectedDate = e.target.value;
        selectedTime = null;
        renderModalContent();
      });

      document.querySelectorAll('.reschedule-slot-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedTime = btn.getAttribute('data-slot');
          renderModalContent();
        });
      });

      document.getElementById('reschedule-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedTime) {
          this.showToast('Por favor selecciona un horario disponible para la cita.', 'error');
          return;
        }

        const srv = biz.services?.find(s => s.id === selectedServiceId) || currentService;
        const notes = document.getElementById('reschedule-notes-input')?.value.trim() || '';

        const updatedData = {
          ...appointment,
          serviceId: srv.id,
          serviceName: srv.name,
          servicePrice: srv.price,
          serviceDuration: srv.duration,
          date: selectedDate,
          time: selectedTime,
          notes
        };

        if (isOwnerMode) {
          updatedData.clientName = document.getElementById('reschedule-client-name')?.value.trim() || appointment.clientName;
          updatedData.clientPhone = document.getElementById('reschedule-client-phone')?.value.trim() || appointment.clientPhone;
          updatedData.status = document.getElementById('reschedule-status-select')?.value || appointment.status;
        } else {
          if (updatedData.status === 'cancelled') {
            updatedData.status = 'confirmed';
          }
        }

        await storage.updateAppointment(appointment.id, updatedData);
        this.showToast('¡Cita modificada y reprogramada con éxito!', 'success');
        modalContainer.innerHTML = '';
        this.renderCurrentView();
      });
    };

    renderModalContent();
  }

  // ==========================================
  // VISTA 4: MIS RESERVAS (HISTORIAL DE CLIENTE)
  // ==========================================
  async renderClientBookingsView(container) {
    const clientUser = storage.getClientUser();
    if (!clientUser) {
      this.renderAuthModal({ mode: 'login', role: 'client' });
      this.navigateTo('directory');
      return;
    }

    const allAppointments = await storage.getClientAppointmentsAsync(clientUser.phone, clientUser.email);
    const filter = this.clientAppointmentFilter || 'all';

    let appointments = allAppointments;
    if (filter === 'active') {
      appointments = allAppointments.filter(a => a.status === 'pending' || a.status === 'confirmed');
    } else if (filter === 'completed') {
      appointments = allAppointments.filter(a => a.status === 'completed');
    } else if (filter === 'cancelled') {
      appointments = allAppointments.filter(a => a.status === 'cancelled');
    }

    const activeCount = allAppointments.filter(a => a.status === 'pending' || a.status === 'confirmed').length;
    const completedCount = allAppointments.filter(a => a.status === 'completed').length;
    const cancelledCount = allAppointments.filter(a => a.status === 'cancelled').length;

    container.innerHTML = `
      <div class="animate-fade-in pb-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div class="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span class="text-xs font-bold text-blue-600 uppercase tracking-wider">Portal de Cliente</span>
            <h1 class="text-2xl font-black text-slate-900 mt-1">Mis Reservas</h1>
            <p class="text-xs text-slate-500 mt-1">Hola <strong>${clientUser.name}</strong> • ${clientUser.phone} ${clientUser.email ? `• ${clientUser.email}` : ''}</p>
          </div>
          <div class="flex items-center gap-2">
            <button id="go-explore-top-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20">
              <i class="fas fa-plus mr-1"></i> Nueva Cita
            </button>
            <button id="client-logout-view-btn" class="px-4 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 rounded-xl text-xs font-bold transition-all">
              <i class="fas fa-sign-out-alt mr-1"></i> Salir
            </button>
          </div>
        </div>

        <!-- Filtros de Estado -->
        <div class="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          <button class="client-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="all">
            Todas (${allAppointments.length})
          </button>
          <button class="client-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === 'active' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="active">
            Activas (${activeCount})
          </button>
          <button class="client-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === 'completed' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="completed">
            Completadas (${completedCount})
          </button>
          <button class="client-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === 'cancelled' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="cancelled">
            Canceladas (${cancelledCount})
          </button>
        </div>

        ${appointments.length === 0 ? `
          <div class="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 shadow-xs">
            <div class="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
              <i class="far fa-calendar-alt"></i>
            </div>
            <h3 class="text-lg font-bold text-slate-800">No hay citas en esta categoría</h3>
            <p class="text-xs text-slate-500 mt-1">Explora los comercios disponibles y agenda tu primer turno.</p>
            <button id="go-explore-btn" class="mt-4 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20">
              Explorar Comercios
            </button>
          </div>
        ` : `
          <div class="space-y-4">
            ${appointments.map(apt => `
              <div class="p-5 sm:p-6 bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col gap-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div class="flex items-center gap-2 mb-1 flex-wrap">
                      <span class="font-black text-lg text-slate-900">${apt.businessName || 'Comercio'}</span>
                      <span class="badge-status badge-status-${apt.status}">
                        ${apt.status === 'confirmed' ? 'Confirmada' : apt.status === 'pending' ? 'Pendiente' : apt.status === 'completed' ? 'Completada' : 'Cancelada'}
                      </span>
                      ${apt.whatsappOptIn !== false ? `
                        <span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <i class="fab fa-whatsapp text-emerald-600"></i> WhatsApp
                        </span>
                      ` : ''}
                    </div>
                    <h4 class="font-bold text-sm text-blue-600">${apt.serviceName}</h4>
                    <div class="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                      <span><i class="far fa-calendar mr-1 text-slate-400"></i><strong>${apt.date}</strong></span>
                      <span><i class="far fa-calendar mr-1 text-slate-400"></i><strong>${this.formatDateDMY(apt.date)}</strong></span>
                      <span><i class="far fa-clock mr-1 text-slate-400"></i><strong>${this.formatTime12h(apt.time)}</strong> (${apt.serviceDuration} min)</span>
                      ${apt.notes ? `<span class="text-slate-400 italic">"${apt.notes}"</span>` : ''}
                    </div>
                  </div>

                  <div class="text-right flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                    <span class="text-xl font-black text-slate-900">${this.formatColones(apt.servicePrice)}</span>
                    <span class="text-[10px] text-slate-400 font-mono mt-0.5">CÓDIGO: #${apt.id.toUpperCase()}</span>
                  </div>
                </div>

                <!-- Botones de Acción para el Cliente -->
                <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2">
                  ${(apt.status === 'pending' || apt.status === 'confirmed') ? `
                    <button class="client-reschedule-btn px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5" data-apt-id="${apt.id}">
                      <i class="fas fa-calendar-alt"></i> Reprogramar Turno
                    </button>
                    <button class="client-cancel-btn px-4 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5" data-apt-id="${apt.id}">
                      <i class="fas fa-times-circle"></i> Cancelar Reserva
                    </button>
                  ` : ''}
                  ${apt.status === 'cancelled' ? `
                    <button class="client-reschedule-btn px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5" data-apt-id="${apt.id}">
                      <i class="fas fa-redo"></i> Reagendar Cita
                    </button>
                  ` : ''}
                  ${apt.status === 'completed' ? `
                    <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1">
                      <i class="fas fa-check-circle"></i> Cita Completada
                    </span>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    document.getElementById('go-explore-top-btn')?.addEventListener('click', () => this.navigateTo('directory'));
    document.getElementById('go-explore-btn')?.addEventListener('click', () => this.navigateTo('directory'));
    
    document.getElementById('client-logout-view-btn')?.addEventListener('click', () => {
      storage.logoutClient();
      this.showToast('Sesión cerrada.', 'info');
      this.renderHeader();
      this.navigateTo('directory');
    });

    document.querySelectorAll('.client-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.clientAppointmentFilter = btn.getAttribute('data-filter');
        this.renderClientBookingsView(container);
      });
    });

    document.querySelectorAll('.client-reschedule-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const aptId = btn.getAttribute('data-apt-id');
        const apt = allAppointments.find(a => a.id === aptId);
        if (apt) {
          this.renderRescheduleModal(apt, false);
        }
      });
    });

    document.querySelectorAll('.client-cancel-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const aptId = btn.getAttribute('data-apt-id');
        if (confirm('¿Estás seguro de que deseas cancelar esta reserva?')) {
          await storage.updateAppointmentStatus(aptId, 'cancelled');
          this.showToast('Reserva cancelada correctamente.', 'info');
          this.renderClientBookingsView(container);
        }
      });
    });
  }

  // ==========================================
  // VISTA 3: PANEL DE DUEÑO DE NEGOCIO (DASHBOARD)
  // ==========================================
  renderOwnerDashboardView(container) {
    const bizUser = storage.getBusinessUser();
    if (!bizUser) {
      this.renderBusinessAuthModal();
      this.navigateTo('directory');
      return;
    }

    const currentBiz = storage.getBusinessById(bizUser.businessId) || storage.getBusinesses()[0];
    if (!currentBiz) {
      this.navigateTo('directory');
      return;
    }

    const appointments = storage.getAppointmentsByBusiness(currentBiz.id);
    const todayStr = this.getTodayDateString();
    const todayAppointments = appointments.filter(a => a.date === todayStr && a.status !== 'cancelled');
    const estimatedRevenue = appointments.filter(a => a.status === 'confirmed' || a.status === 'completed').reduce((sum, a) => sum + (a.servicePrice || 0), 0);

    container.innerHTML = `
      <div class="animate-fade-in pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <!-- Top Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs mb-8">
          <div class="flex items-center gap-4">
            <img src="${currentBiz.image || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80'}" alt="${currentBiz.name}" class="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-sm">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-blue-600 uppercase tracking-wider">Panel Administrador</span>
                ${currentBiz.isDemo ? `
                  <span class="bg-purple-100 text-purple-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md">Comercio de Muestra</span>
                ` : `
                  <span class="bg-emerald-100 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-md">Comercio Verificado</span>
                `}
              </div>
              <h1 class="text-xl font-extrabold text-slate-900">${currentBiz.name}</h1>
              <span class="text-xs text-slate-500">Sesión iniciada como: <strong>${bizUser.name || bizUser.email}</strong></span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button id="dash-logout-btn" class="px-4 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 rounded-xl text-xs font-bold transition-all">
              <i class="fas fa-sign-out-alt mr-1"></i> Salir del Panel
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
              <span class="font-extrabold text-emerald-600 text-sm">CRC</span>
            </div>
            <span class="text-2xl font-black text-slate-900">${this.formatColones(estimatedRevenue)}</span>
            <span class="text-[11px] text-emerald-600 block mt-1">citas confirmadas</span>
          </div>

          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 mb-2">
              <span class="text-xs font-semibold uppercase">Servicios</span>
              <i class="fas fa-list text-amber-600"></i>
            </div>
            <span class="text-2xl font-black text-slate-900">${currentBiz.services ? currentBiz.services.length : 0}</span>
            <span class="text-[11px] text-slate-400 block mt-1">activos en catálogo</span>
          </div>
        </div>

        <!-- Tabs Navigation -->
        <div class="flex items-center gap-2 border-b border-slate-200 mb-6 overflow-x-auto pb-2">
          <button class="dash-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${this.activeDashboardTab === 'appointments' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}" data-tab="appointments">
            <i class="fas fa-calendar-alt mr-1.5"></i> Agenda (${appointments.length})
          </button>
          <button class="dash-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${this.activeDashboardTab === 'services' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}" data-tab="services">
            <i class="fas fa-tag mr-1.5"></i> Servicios y Precios (${currentBiz.services ? currentBiz.services.length : 0})
          </button>
          <button class="dash-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${this.activeDashboardTab === 'profile' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}" data-tab="profile">
            <i class="fas fa-image mr-1.5"></i> Perfil, Fotos & Banner
          </button>
          <button class="dash-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${this.activeDashboardTab === 'schedule' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}" data-tab="schedule">
            <i class="fas fa-clock mr-1.5"></i> Horarios de Atención
          </button>
        </div>

        <!-- Dynamic Tab Content -->
        <div id="dashboard-tab-content">
          ${this.renderDashboardTabContent(currentBiz, appointments)}
        </div>
      </div>
    `;

    document.getElementById('dash-logout-btn')?.addEventListener('click', () => {
      storage.logoutBusiness();
      this.showToast('Sesión de negocio cerrada.', 'info');
      this.renderHeader();
      this.navigateTo('directory');
    });

    document.querySelectorAll('.dash-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.activeDashboardTab = btn.getAttribute('data-tab');
        this.renderCurrentView();
      });
    });

    this.setupDashboardTabEvents(currentBiz);
  }

  // --- SUB-CONTENIDOS DEL DASHBOARD ---
  renderDashboardTabContent(currentBiz, appointments) {
    if (this.activeDashboardTab === 'appointments') {
      const filter = this.ownerAppointmentFilter || 'all';
      let filteredAppointments = appointments;

      if (filter === 'pending') {
        filteredAppointments = appointments.filter(a => a.status === 'pending');
      } else if (filter === 'confirmed') {
        filteredAppointments = appointments.filter(a => a.status === 'confirmed');
      } else if (filter === 'completed') {
        filteredAppointments = appointments.filter(a => a.status === 'completed');
      } else if (filter === 'cancelled') {
        filteredAppointments = appointments.filter(a => a.status === 'cancelled');
      }

      const pendingCount = appointments.filter(a => a.status === 'pending').length;
      const confirmedCount = appointments.filter(a => a.status === 'confirmed').length;
      const completedCount = appointments.filter(a => a.status === 'completed').length;
      const cancelledCount = appointments.filter(a => a.status === 'cancelled').length;

      return `
        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 class="text-lg font-bold text-slate-900">Agenda y Reservas</h2>
              <p class="text-xs text-slate-500">Gestiona, acepta, reprograma, cancela y actualiza reservas en tiempo real.</p>
            </div>

            <button id="add-manual-appointment-btn" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-500/20">
              <i class="fas fa-plus-circle"></i> Nueva Reserva Manual
            </button>
          </div>

          <!-- Filtros de Estado para el Dueño -->
          <div class="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            <button class="owner-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="all">
              Todas (${appointments.length})
            </button>
            <button class="owner-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === 'pending' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="pending">
              ⏳ Pendientes (${pendingCount})
            </button>
            <button class="owner-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === 'confirmed' ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="confirmed">
              ✅ Confirmadas (${confirmedCount})
            </button>
            <button class="owner-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === 'completed' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="completed">
              🎉 Completadas (${completedCount})
            </button>
            <button class="owner-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === 'cancelled' ? 'bg-rose-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="cancelled">
              ❌ Canceladas (${cancelledCount})
            </button>
          </div>

          ${filteredAppointments.length === 0 ? `
            <div class="text-center py-12 text-slate-400">
              <i class="far fa-calendar-times text-4xl mb-2"></i>
              <p class="text-sm font-semibold">No hay reservas en esta categoría.</p>
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
                    <th class="py-3 px-4 text-right">Acciones de Gestión</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  ${filteredAppointments.map(apt => `
                    <tr class="hover:bg-slate-50/80 transition-colors">
                      <td class="py-3.5 px-4 font-bold text-slate-900">
                        <div>${apt.date}</div>
                        <div>${this.formatDateDMY(apt.date)}</div>
                        <div class="text-blue-600 text-[11px] font-mono">${this.formatTime12h(apt.time)} (${apt.serviceDuration}m)</div>
                      </td>
                      <td class="py-3.5 px-4">
                        <div class="font-bold text-slate-800">${apt.clientName}</div>
                        <div class="text-slate-400 text-[11px]">${apt.clientPhone}</div>
                      </td>
                      <td class="py-3.5 px-4 font-medium text-slate-700">
                        <div class="font-semibold text-slate-800">${apt.serviceName}</div>
                        ${apt.notes ? `<div class="text-[10px] text-slate-400 italic">"${apt.notes}"</div>` : ''}
                      </td>
                      <td class="py-3.5 px-4 font-extrabold text-slate-900">
                        ${this.formatColones(apt.servicePrice)}
                      </td>
                      <td class="py-3.5 px-4">
                        <span class="badge-status badge-status-${apt.status}">
                          ${apt.status === 'confirmed' ? 'Confirmada' : apt.status === 'pending' ? 'Pendiente' : apt.status === 'completed' ? 'Completada' : 'Cancelada'}
                        </span>
                      </td>
                      <td class="py-3.5 px-4 text-right space-x-1">
                        <!-- Aceptar / Confirmar -->
                        ${(apt.status === 'pending' || apt.status === 'cancelled') ? `
                          <button class="status-change-btn px-2.5 py-1.5 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1" data-apt-id="${apt.id}" data-status="confirmed" title="Aceptar y confirmar reserva">
                            <i class="fas fa-check-circle"></i> Aceptar
                          </button>
                        ` : ''}

                        <!-- Marcar como Completada -->
                        ${(apt.status === 'confirmed' || apt.status === 'pending') ? `
                          <button class="status-change-btn px-2.5 py-1.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1" data-apt-id="${apt.id}" data-status="completed" title="Marcar como atendida / completada">
                            <i class="fas fa-clipboard-check"></i> Completar
                          </button>
                        ` : ''}

                        <!-- Reprogramar / Modificar -->
                        <button class="edit-appointment-btn px-2.5 py-1.5 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1" data-apt-id="${apt.id}" title="Modificar fecha, hora, servicio o datos">
                          <i class="fas fa-calendar-alt"></i> Modificar
                        </button>

                        <!-- Cancelar -->
                        ${apt.status !== 'cancelled' ? `
                          <button class="status-change-btn px-2.5 py-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1" data-apt-id="${apt.id}" data-status="cancelled" title="Cancelar reserva">
                            <i class="fas fa-ban"></i> Cancelar
                          </button>
                        ` : ''}

                        <!-- Eliminar -->
                        <button class="delete-apt-btn p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center" data-apt-id="${apt.id}" title="Eliminar registro">
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
              <h2 class="text-lg font-bold text-slate-900">Catálogo de Servicios y Precios</h2>
              <p class="text-xs text-slate-500">Agrega, modifica precios en colones (₡) o duraciones de tus servicios.</p>
            </div>

            <button id="add-new-service-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all">
              <i class="fas fa-plus"></i> Agregar Servicio
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${currentBiz.services && currentBiz.services.length > 0 ? currentBiz.services.map(srv => `
              <div class="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div class="flex items-center justify-between">
                    <h3 class="font-bold text-base text-slate-900">${srv.name}</h3>
                    <span class="text-base font-black text-blue-600">${this.formatColones(srv.price)}</span>
                  </div>
                  <span class="inline-block mt-1 px-2.5 py-0.5 rounded-md bg-slate-200 text-slate-700 text-xs font-semibold">
                    <i class="far fa-clock mr-1"></i>${srv.duration} minutos
                  </span>
                  <p class="text-xs text-slate-500 mt-2">${srv.description || 'Sin descripción'}</p>
                </div>

                <div class="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-end gap-2">
                  <button class="edit-service-btn text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors" data-service-id="${srv.id}">
                    <i class="fas fa-edit mr-1"></i> Editar
                  </button>
                  <button class="delete-service-btn text-xs font-bold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors" data-service-id="${srv.id}">
                    <i class="fas fa-trash-alt mr-1"></i> Eliminar
                  </button>
                </div>
              </div>
            `).join('') : `
              <p class="text-sm text-slate-400 py-4 col-span-2 text-center">No hay servicios registrados. Agrega el primero con el botón superior.</p>
            `}
          </div>
        </div>
      `;
    }

    if (this.activeDashboardTab === 'profile') {
      const allFeatures = [
        'Sinpe Móvil', 'Acepta Tarjeta', 'Parqueo Gratis', 'Parqueo Bajo Techo',
        'Aire Acondicionado', 'WiFi Gratis', 'Pet Friendly', 'Acceso Silla de Ruedas',
        'Café de Cortesía', 'Sala de Espera', 'Atención Personalizada', 'Garantía por Escrito'
      ];
      const currentFeatures = currentBiz.features || [];

      return `
        <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs max-w-3xl">
          <h2 class="text-lg font-bold text-slate-900 mb-1">Editar Perfil, Fotos & Banner</h2>
          <p class="text-xs text-slate-500 mb-6">Personaliza la imagen y los datos de contacto que ven tus clientes en el directorio.</p>

          <form id="edit-profile-form" class="space-y-6 text-xs sm:text-sm">
            <!-- Sección Fotos con Guía de Medidas -->
            <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-5">
              <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
                <i class="fas fa-images text-blue-600"></i> Fotos y Banners del Comercio
              </h3>

              <!-- Banner de Portada -->
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <label class="font-bold text-slate-700">Banner / Portada Principal</label>
                  <span class="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                    <i class="fas fa-ruler-combined mr-1"></i> Medida: 1200 x 450 px (16:6)
                  </span>
                </div>
                <input type="text" id="edit-biz-cover" value="${currentBiz.coverImage || ''}" placeholder="URL de la imagen de portada (https://...)" class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl">
                <!-- Preview Banner -->
                <div class="h-32 w-full rounded-xl overflow-hidden bg-slate-200 border border-slate-300 relative">
                  <img id="preview-cover-img" src="${currentBiz.coverImage || currentBiz.image}" alt="Vista previa banner" class="w-full h-full object-cover">
                  <span class="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">Vista previa del banner</span>
                </div>
              </div>

              <!-- Foto de Perfil / Logo -->
              <div class="space-y-2 pt-3 border-t border-slate-200">
                <div class="flex items-center justify-between">
                  <label class="font-bold text-slate-700">Foto de Perfil / Logo Cuadrado</label>
                  <span class="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200">
                    <i class="fas fa-ruler-combined mr-1"></i> Medida: 800 x 800 px (1:1)
                  </span>
                </div>
                <input type="text" id="edit-biz-image" value="${currentBiz.image || ''}" placeholder="URL del logo o foto de perfil (https://...)" class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl">
                <!-- Preview Logo -->
                <div class="flex items-center gap-3">
                  <img id="preview-logo-img" src="${currentBiz.image}" alt="Vista previa logo" class="w-16 h-16 rounded-2xl object-cover border border-slate-300">
                  <span class="text-xs text-slate-500">Se muestra en las tarjetas de búsqueda del directorio.</span>
                </div>
              </div>
            </div>

            <!-- Datos Generales -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Nombre del Negocio *</label>
                <input type="text" id="edit-biz-name" value="${currentBiz.name}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Ciudad / Cantón *</label>
                <input type="text" id="edit-biz-city" value="${currentBiz.city}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Teléfono / WhatsApp *</label>
                <input type="tel" id="edit-biz-phone" value="${currentBiz.phone}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Correo Electrónico</label>
                <input type="email" id="edit-biz-email" value="${currentBiz.email || ''}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Dirección Exacta</label>
              <input type="text" id="edit-biz-address" value="${currentBiz.address || ''}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Descripción del Negocio</label>
              <textarea id="edit-biz-desc" rows="3" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">${currentBiz.description || ''}</textarea>
            </div>

            <!-- Características / Comodidades -->
            <div>
              <label class="block font-bold text-slate-700 mb-2 uppercase text-xs tracking-wider">Comodidades y Métodos de Pago</label>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                ${allFeatures.map(feat => `
                  <label class="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-xs">
                    <input type="checkbox" name="biz_features" value="${feat}" ${currentFeatures.includes(feat) ? 'checked' : ''} class="rounded text-blue-600">
                    <span class="font-medium text-slate-700">${feat}</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <button type="submit" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/25 transition-all text-sm">
              <i class="fas fa-save mr-1.5"></i> Guardar Cambios de Perfil
            </button>
          </form>
        </div>
      `;
    }

    if (this.activeDashboardTab === 'schedule') {
      const sch = currentBiz.schedule || { days: [1,2,3,4,5,6], openTime: '08:00', closeTime: '18:00' };
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
                    <input type="checkbox" name="work_days" value="${d.id}" ${sch.days && sch.days.includes(d.id) ? 'checked' : ''} class="rounded text-blue-600 focus:ring-blue-500">
                    <span class="font-medium text-slate-800">${d.name}</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <!-- Horarios de Apertura y Cierre -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Hora de Apertura</label>
                <input type="time" id="open-time" value="${sch.openTime || '08:00'}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Hora de Cierre</label>
                <input type="time" id="close-time" value="${sch.closeTime || '18:00'}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
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
    document.querySelectorAll('.owner-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.ownerAppointmentFilter = btn.getAttribute('data-filter');
        this.renderCurrentView();
      });
    });

    document.querySelectorAll('.edit-appointment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const aptId = btn.getAttribute('data-apt-id');
        const appointments = storage.getAppointmentsByBusiness(currentBiz.id);
        const apt = appointments.find(a => a.id === aptId);
        if (apt) {
          this.renderRescheduleModal(apt, true);
        }
      });
    });

    document.querySelectorAll('.status-change-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const aptId = btn.getAttribute('data-apt-id');
        const newStatus = btn.getAttribute('data-status');
        await storage.updateAppointmentStatus(aptId, newStatus);
        const statusMsgs = {
          confirmed: '¡Reserva aceptada y confirmada con éxito!',
          completed: '¡Reserva marcada como completada / atendida!',
          cancelled: 'Reserva cancelada.'
        };
        this.showToast(statusMsgs[newStatus] || `Estado actualizado a: ${newStatus}`, newStatus === 'cancelled' ? 'info' : 'success');
        this.renderCurrentView();
      });
    });

    document.querySelectorAll('.delete-apt-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const aptId = btn.getAttribute('data-apt-id');
        if (confirm('¿Deseas eliminar este registro de reserva permanentemente?')) {
          await storage.deleteAppointment(aptId);
          this.showToast('Reserva eliminada.', 'info');
          this.renderCurrentView();
        }
      });
    });

    document.getElementById('add-manual-appointment-btn')?.addEventListener('click', () => {
      this.openBookingModal(currentBiz.id, currentBiz.services && currentBiz.services[0]?.id);
    });

    document.getElementById('add-new-service-btn')?.addEventListener('click', () => {
      this.renderNewServiceModal(currentBiz.id);
    });

    document.querySelectorAll('.edit-service-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-service-id');
        const service = currentBiz.services?.find(s => s.id === sId);
        if (service) {
          this.renderEditServiceModal(currentBiz.id, service);
        }
      });
    });

    document.querySelectorAll('.delete-service-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sId = btn.getAttribute('data-service-id');
        if (confirm('¿Eliminar este servicio del catálogo?')) {
          await storage.deleteService(currentBiz.id, sId);
          this.showToast('Servicio eliminado.', 'info');
          this.renderCurrentView();
        }
      });
    });

    const coverInput = document.getElementById('edit-biz-cover');
    const imageInput = document.getElementById('edit-biz-image');
    coverInput?.addEventListener('input', (e) => {
      const img = document.getElementById('preview-cover-img');
      if (img && e.target.value) img.src = e.target.value;
    });
    imageInput?.addEventListener('input', (e) => {
      const img = document.getElementById('preview-logo-img');
      if (img && e.target.value) img.src = e.target.value;
    });

    const profileForm = document.getElementById('edit-profile-form');
    profileForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('edit-biz-name').value;
      const city = document.getElementById('edit-biz-city').value;
      const phone = document.getElementById('edit-biz-phone').value;
      const email = document.getElementById('edit-biz-email').value;
      const address = document.getElementById('edit-biz-address').value;
      const description = document.getElementById('edit-biz-desc').value;
      const image = document.getElementById('edit-biz-image').value;
      const coverImage = document.getElementById('edit-biz-cover').value;
      const features = Array.from(document.querySelectorAll('input[name="biz_features"]:checked')).map(cb => cb.value);

      await storage.saveBusiness({
        ...currentBiz,
        name,
        city,
        phone,
        email,
        address,
        description,
        image,
        coverImage,
        features
      });

      this.showToast('¡Perfil del negocio actualizado con éxito!', 'success');
      this.renderCurrentView();
    });

    const scheduleForm = document.getElementById('schedule-form');
    scheduleForm?.addEventListener('submit', async (e) => {
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
        slotDuration: currentBiz.schedule?.slotDuration || 30
      };

      await storage.saveBusiness(currentBiz);
      this.showToast('Horarios actualizados exitosamente.', 'success');
      this.renderCurrentView();
    });
  }

  // ==========================================
  // VISTA 5: PANEL SUPERADMIN DEVELOPER
  // ==========================================
  async renderDeveloperDashboardView(container) {
    const devUser = storage.getDeveloperUser();
    if (!devUser) {
      container.innerHTML = `
        <div class="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-slate-200 text-center shadow-lg">
          <div class="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            <i class="fas fa-lock"></i>
          </div>
          <h2 class="text-xl font-bold text-slate-800 mb-2">Acceso Restringido</h2>
          <p class="text-sm text-slate-500 mb-6">Esta sección es de uso exclusivo para el equipo de desarrollo y administración de TurnoYa.</p>
          <button id="dev-back-home-btn" class="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition-all">
            Ir al Inicio
          </button>
        </div>
      `;
      document.getElementById('dev-back-home-btn')?.addEventListener('click', () => this.navigateTo('directory'));
      return;
    }

    // Mostrar loader mientras cargan los datos
    container.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div class="flex items-center justify-center py-20 text-slate-400 gap-3">
          <i class="fas fa-circle-notch fa-spin text-2xl text-blue-600"></i>
          <span class="font-medium text-slate-600">Cargando panel de Developer...</span>
        </div>
      </div>
    `;

    try {
      const [stats, businesses, clients, appointments, alerts] = await Promise.all([
        storage.getDeveloperStats(),
        storage.getDeveloperBusinesses(),
        storage.getDeveloperClients(),
        storage.getDeveloperAppointments(),
        storage.getDeveloperCategoryAlerts()
      ]);

      const pendingAlerts = alerts.filter(a => a.status === 'unread' || a.status === 'pending');
      const q = (this.devSearchQuery || '').toLowerCase().trim();

      // Métricas y filtrado por sub-pestañas en negocios
      const activeBusinessesCount = businesses.filter(b => !b.isHidden && !b.isBlocked).length;
      const hiddenBusinessesCount = businesses.filter(b => b.isHidden).length;
      const blockedBusinessesCount = businesses.filter(b => b.isBlocked).length;
      const realBusinessesCount = businesses.filter(b => !b.isDemo).length;
      const demoBusinessesCount = businesses.filter(b => b.isDemo).length;

      let devBusinessesList = businesses;
      if (this.devBizFilter === 'active') {
        devBusinessesList = businesses.filter(b => !b.isHidden && !b.isBlocked);
      } else if (this.devBizFilter === 'hidden') {
        devBusinessesList = businesses.filter(b => b.isHidden);
      } else if (this.devBizFilter === 'blocked') {
        devBusinessesList = businesses.filter(b => b.isBlocked);
      } else if (this.devBizFilter === 'real') {
        devBusinessesList = businesses.filter(b => !b.isDemo);
      } else if (this.devBizFilter === 'demo') {
        devBusinessesList = businesses.filter(b => b.isDemo);
      }

      // Filtrado por buscador
      const filteredBusinesses = devBusinessesList.filter(b => 
        !q || (b.name && b.name.toLowerCase().includes(q)) || 
        (b.categoryLabel && b.categoryLabel.toLowerCase().includes(q)) || 
        (b.email && b.email.toLowerCase().includes(q)) || 
        (b.city && b.city.toLowerCase().includes(q))
      );

      const filteredClients = clients.filter(c => 
        !q || (c.name && c.name.toLowerCase().includes(q)) || 
        (c.phone && c.phone.toLowerCase().includes(q)) || 
        (c.email && c.email.toLowerCase().includes(q))
      );

      const filteredAppointments = appointments.filter(a => 
        !q || ((a.clientName || a.client_name) && (a.clientName || a.client_name).toLowerCase().includes(q)) || 
        ((a.businessName || a.business_name) && (a.businessName || a.business_name).toLowerCase().includes(q)) || 
        ((a.serviceName || a.service_name) && (a.serviceName || a.service_name).toLowerCase().includes(q))
      );

      const filteredAlerts = alerts.filter(a => 
        !q || ((a.businessName || a.business_name) && (a.businessName || a.business_name).toLowerCase().includes(q)) || 
        ((a.categoryName || a.category_name) && (a.categoryName || a.category_name).toLowerCase().includes(q))
      );

      container.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in space-y-6">
          
          <!-- Header del Panel Developer -->
          <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-1 bg-amber-500 text-slate-950 text-xs font-black tracking-wider rounded-lg uppercase">
                  SuperAdmin Dev Mode
                </span>
                <span class="text-xs text-slate-400 font-mono">v1.2.0 • Costa Rica</span>
              </div>
              <h1 class="text-2xl sm:text-3xl font-black tracking-tight">Panel de Control Developer</h1>
              <p class="text-sm text-slate-300">Monitoreo global de datos, comercios registrados, clientes y categorías personalizadas.</p>
            </div>

            <div class="flex items-center gap-3">
              <div class="text-right hidden sm:block">
                <span class="text-xs text-slate-400 block font-medium">Sesión activa como</span>
                <span class="text-sm font-bold text-amber-400">${devUser.name || 'Developer Master'}</span>
              </div>
              <button id="dev-logout-view-btn" class="px-4 py-2 bg-white/10 hover:bg-rose-600/80 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2">
                <i class="fas fa-sign-out-alt"></i>
                <span>Salir del Panel</span>
              </button>
            </div>
          </div>

          <!-- Métricas Globales -->
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <!-- Comercios -->
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl flex-shrink-0">
                <i class="fas fa-store"></i>
              </div>
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Comercios</span>
                <span class="text-2xl font-extrabold text-slate-900">${stats.totalBusinesses || businesses.length}</span>
              </div>
            </div>

            <!-- Clientes -->
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div class="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl flex-shrink-0">
                <i class="fas fa-users"></i>
              </div>
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Clientes Registrados</span>
                <span class="text-2xl font-extrabold text-slate-900">${stats.totalClients || clients.length}</span>
              </div>
            </div>

            <!-- Citas Globales -->
            <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
              <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl flex-shrink-0">
                <i class="fas fa-calendar-check"></i>
              </div>
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Reservas</span>
                <span class="text-2xl font-extrabold text-slate-900">${stats.totalAppointments || appointments.length}</span>
              </div>
            </div>

            <!-- Alertas de Categorías Nuevas -->
            <div class="bg-white p-5 rounded-2xl border ${pendingAlerts.length > 0 ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200'} shadow-xs flex items-center gap-4">
              <div class="w-12 h-12 rounded-2xl ${pendingAlerts.length > 0 ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-slate-100 text-slate-600'} flex items-center justify-center text-xl flex-shrink-0">
                <i class="fas fa-bell"></i>
              </div>
              <div>
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider block">Nuevas Categorías</span>
                <div class="flex items-center gap-2">
                  <span class="text-2xl font-extrabold ${pendingAlerts.length > 0 ? 'text-amber-700' : 'text-slate-900'}">${pendingAlerts.length}</span>
                  ${pendingAlerts.length > 0 ? `<span class="text-[10px] font-extrabold bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full">Pendientes</span>` : ''}
                </div>
              </div>
            </div>
          </div>

          <!-- Navegación por Pestañas + Buscador -->
          <div class="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            
            <div class="p-4 sm:p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <!-- Tabs -->
              <div class="flex flex-wrap gap-2">
                <button id="dev-tab-alerts" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${this.activeDevTab === 'alerts' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
                  <i class="fas fa-bell"></i>
                  <span>Nuevas Categorías</span>
                  ${pendingAlerts.length > 0 ? `<span class="px-2 py-0.5 bg-slate-950 text-amber-400 text-[10px] rounded-full font-black">${pendingAlerts.length}</span>` : ''}
                </button>

                <button id="dev-tab-businesses" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${this.activeDevTab === 'businesses' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
                  <i class="fas fa-store"></i>
                  <span>Directorio de Negocios (${businesses.length})</span>
                </button>

                <button id="dev-tab-clients" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${this.activeDevTab === 'clients' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
                  <i class="fas fa-users"></i>
                  <span>Usuarios / Clientes (${clients.length})</span>
                </button>

                <button id="dev-tab-appointments" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${this.activeDevTab === 'appointments' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
                  <i class="fas fa-calendar-alt"></i>
                  <span>Citas Globales (${appointments.length})</span>
                </button>
              </div>

              <!-- Buscador Rápido -->
              <div class="relative w-full md:w-72">
                <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                <input type="text" id="dev-search-input" value="${this.devSearchQuery || ''}" placeholder="Buscar en esta tabla..." class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>
            </div>

            <!-- CONTENIDO DE LA PESTAÑA ACTIVA -->
            <div class="p-4 sm:p-6">
              
              <!-- PESTAÑA 1: ALERTAS & NUEVAS CATEGORÍAS -->
              ${this.activeDevTab === 'alerts' ? `
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-base font-bold text-slate-800">Alertas de Categorías Creadas por Comercios</h3>
                      <p class="text-xs text-slate-500">Notificaciones en tiempo real cuando un comercio escribe una categoría personalizada que no estaba en el catálogo original.</p>
                    </div>
                  </div>

                  ${filteredAlerts.length === 0 ? `
                    <div class="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
                      <i class="fas fa-check-double text-3xl text-emerald-500 mb-2"></i>
                      <p class="text-sm font-bold text-slate-700">No hay alertas registradas</p>
                      <p class="text-xs text-slate-400">Cuando un comercio use "Otra Categoría (Personalizada)", aparecerá aquí de inmediato.</p>
                    </div>
                  ` : `
                    <div class="overflow-x-auto">
                      <table class="w-full text-left text-xs text-slate-600">
                        <thead class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th class="p-3">Estado</th>
                            <th class="p-3">Categoría Creada</th>
                            <th class="p-3">Comercio que la Ingresó</th>
                            <th class="p-3">Fecha y Hora</th>
                            <th class="p-3 text-right">Acción</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium">
                          ${filteredAlerts.map(a => {
                            const isPending = a.status === 'unread' || a.status === 'pending';
                            const catName = a.categoryName || a.category_name || 'Personalizada';
                            const catId = a.categoryId || a.category_id || '';
                            const bizName = a.businessName || a.business_name || 'Comercio';
                            const bizId = a.businessId || a.business_id || '';
                            const alertDate = a.createdAt || a.created_at;

                            return `
                            <tr class="hover:bg-slate-50/80 transition-colors ${isPending ? 'bg-amber-50/30' : ''}">
                              <td class="p-3">
                                ${isPending ? `
                                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                                    <i class="fas fa-clock"></i> Pendiente
                                  </span>
                                ` : `
                                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <i class="fas fa-check"></i> Revisada
                                  </span>
                                `}
                              </td>
                              <td class="p-3">
                                <span class="font-bold text-slate-900 text-sm block">${catName}</span>
                                <span class="text-[10px] text-slate-400 font-mono">ID: ${catId}</span>
                              </td>
                              <td class="p-3">
                                <span class="font-bold text-slate-800 block">${bizName}</span>
                                <span class="text-[10px] text-slate-400">Biz ID: ${bizId}</span>
                              </td>
                              <td class="p-3 text-slate-500 whitespace-nowrap">
                                ${alertDate ? new Date(alertDate).toLocaleString('es-CR') : 'Reciente'}
                              </td>
                              <td class="p-3 text-right">
                                ${isPending ? `
                                  <button class="dismiss-alert-btn px-3 py-1.5 bg-slate-900 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-xs" data-id="${a.id}">
                                    <i class="fas fa-check mr-1"></i> Marcar Revisada
                                  </button>
                                ` : `
                                  <span class="text-xs text-slate-400 font-medium">Aprobada</span>
                                `}
                              </td>
                            </tr>
                          `}).join('')}
                        </tbody>
                      </table>
                    </div>
                  `}
                </div>
              ` : ''}

              <!-- PESTAÑA 2: DIRECTORIO DE NEGOCIOS -->
              ${this.activeDevTab === 'businesses' ? `
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                <div class="space-y-5">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 class="text-base font-bold text-slate-800">Directorio General de Comercios</h3>
                      <p class="text-xs text-slate-500">Listado completo de comercios de muestra y registrados con contacto de dueños.</p>
                      <h3 class="text-base font-bold text-slate-900">Directorio General de Comercios</h3>
                      <p class="text-xs text-slate-500">Administra todos los comercios: ocúltalos de la página de inicio, bloquéalos o elimínalos.</p>
                    </div>

                    <!-- Mini resumen en badges -->
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs">
                        <i class="fas fa-check-circle text-emerald-600"></i> ${activeBusinessesCount} Activos
                      </span>
                      <span class="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs">
                        <i class="fas fa-eye-slash text-amber-600"></i> ${hiddenBusinessesCount} Ocultos
                      </span>
                      <span class="px-3 py-1.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs">
                        <i class="fas fa-ban text-rose-600"></i> ${blockedBusinessesCount} Bloqueados
                      </span>
                    </div>
                  </div>

                  <!-- Chips de filtrado rápido por estado/tipo -->
                  <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <button class="dev-biz-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${this.devBizFilter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-filter="all">
                      Todos (${businesses.length})
                    </button>
                    <button class="dev-biz-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${this.devBizFilter === 'active' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-filter="active">
                      <i class="fas fa-check-circle mr-1"></i> Activos (${activeBusinessesCount})
                    </button>
                    <button class="dev-biz-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${this.devBizFilter === 'hidden' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-filter="hidden">
                      <i class="fas fa-eye-slash mr-1"></i> Ocultos en Inicio (${hiddenBusinessesCount})
                    </button>
                    <button class="dev-biz-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${this.devBizFilter === 'blocked' ? 'bg-rose-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-filter="blocked">
                      <i class="fas fa-ban mr-1"></i> Bloqueados (${blockedBusinessesCount})
                    </button>
                    <button class="dev-biz-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${this.devBizFilter === 'real' ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-filter="real">
                      Registrados Reales (${realBusinessesCount})
                    </button>
                    <button class="dev-biz-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${this.devBizFilter === 'demo' ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}" data-filter="demo">
                      Muestra (${demoBusinessesCount})
                    </button>
                  </div>

                  ${filteredBusinesses.length === 0 ? `
                    <div class="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400">
                      <i class="fas fa-store-slash text-3xl mb-2"></i>
                      <p class="text-sm font-bold text-slate-700">No se encontraron comercios con esa búsqueda</p>
                      <p class="text-sm font-bold text-slate-700">No se encontraron comercios en esta categoría o búsqueda</p>
                    </div>
                  ` : `
                    <div class="overflow-x-auto">
                      <table class="w-full text-left text-xs text-slate-600">
                        <thead class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th class="p-3">Comercio</th>
                            <th class="p-3">Categoría</th>
                            <th class="p-3">Ubicación / Contacto</th>
                            <th class="p-3">Dueño / Correo</th>
                            <th class="p-3">Servicios</th>
                            <th class="p-3">Estado Actual</th>
                            <th class="p-3">Tipo</th>
                            <th class="p-3 text-right">Acciones</th>
                            <th class="p-3 text-right">Acciones de Developer</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium">
                          ${filteredBusinesses.map(b => `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                            <tr class="hover:bg-slate-50/80 transition-colors ${b.isBlocked ? 'bg-rose-50/30' : b.isHidden ? 'bg-amber-50/30' : ''}">
                              <td class="p-3">
                                <div class="flex items-center gap-3">
                                  <img src="${b.image || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80'}" alt="${b.name}" class="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs flex-shrink-0">
                                  <div>
                                    <span class="font-bold text-slate-900 block">${b.name}</span>
                                    <span class="font-bold text-slate-900 block text-sm">${b.name}</span>
                                    <span class="text-[10px] text-slate-400 font-mono">ID: ${b.id}</span>
                                  </div>
                                </div>
                              </td>
                              <td class="p-3">
                                <span class="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-semibold text-[11px]">${b.categoryLabel || b.category}</span>
                                <span class="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-semibold text-[11px] block whitespace-nowrap">${b.categoryLabel || b.category}</span>
                              </td>
                              <td class="p-3">
                                <span class="block text-slate-800">${b.city || 'Costa Rica'}</span>
                                <span class="block text-slate-800 font-semibold">${b.city || 'Costa Rica'}</span>
                                <span class="text-[10px] text-slate-400">${b.phone || 'Sin teléfono'}</span>
                              </td>
                              <td class="p-3">
                                <span class="block text-slate-800">${b.ownerName || (b.isDemo ? 'Demo Admin' : 'Registrado')}</span>
                                <span class="text-[10px] text-slate-400">${b.ownerEmail || b.email || 'N/A'}</span>
                              </td>
                              <td class="p-3">
                                <span class="font-bold text-slate-800">${b.servicesCount !== undefined ? b.servicesCount : (b.services ? b.services.length : 0)} servicios</span>
                              <td class="p-3 whitespace-nowrap">
                                ${b.isBlocked ? `
                                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200" title="Suspendido: ${b.blockReason || 'Sin motivo'}">
                                    <i class="fas fa-ban text-rose-600"></i> Bloqueado
                                  </span>
                                ` : b.isHidden ? `
                                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200" title="No aparece en la página principal">
                                    <i class="fas fa-eye-slash text-amber-600"></i> Oculto en Inicio
                                  </span>
                                ` : `
                                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200" title="Visible y aceptando reservas">
                                    <i class="fas fa-check-circle text-emerald-600"></i> Activo & Visible
                                  </span>
                                `}
                              </td>
                              <td class="p-3">
                              <td class="p-3 whitespace-nowrap">
                                ${b.isDemo ? `
                                  <span class="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded">Muestra</span>
                                ` : `
                                  <span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">Real</span>
                                `}
                              </td>
                              <td class="p-3 text-right">
                              <td class="p-3 text-right whitespace-nowrap">
                                <div class="flex items-center justify-end gap-1.5">
                                  <button class="dev-view-biz-btn p-2 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-colors" data-id="${b.id}" title="Ver en Directorio">
                                    <i class="fas fa-eye text-xs"></i>
                                  <!-- Ver en Directorio -->
                                  <button class="dev-view-biz-btn p-2 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition-all" data-id="${b.id}" title="Ver página del comercio">
                                    <i class="fas fa-external-link-alt text-xs"></i>
                                  </button>
                                  ${!b.isDemo ? `
                                    <button class="dev-delete-biz-btn p-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg transition-colors" data-id="${b.id}" data-name="${b.name}" title="Eliminar Comercio">
                                      <i class="fas fa-trash-alt text-xs"></i>

                                  <!-- Ocultar / Mostrar en Inicio -->
                                  ${b.isHidden ? `
                                    <button class="dev-toggle-visibility-btn px-2.5 py-1.5 bg-amber-100 hover:bg-emerald-100 text-amber-900 hover:text-emerald-900 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs" data-id="${b.id}" data-action="show" data-name="${b.name}" title="Hacer visible en la página principal">
                                      <i class="fas fa-eye text-emerald-600"></i> Mostrar
                                    </button>
                                  ` : ''}
                                  ` : `
                                    <button class="dev-toggle-visibility-btn px-2.5 py-1.5 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1" data-id="${b.id}" data-action="hide" data-name="${b.name}" title="Ocultar de la página principal">
                                      <i class="fas fa-eye-slash text-amber-600"></i> Ocultar
                                    </button>
                                  `}

                                  <!-- Bloquear / Desbloquear -->
                                  ${b.isBlocked ? `
                                    <button class="dev-toggle-block-btn px-2.5 py-1.5 bg-rose-100 hover:bg-emerald-100 text-rose-900 hover:text-emerald-900 border border-rose-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs" data-id="${b.id}" data-action="unblock" data-name="${b.name}" title="Desbloquear este comercio">
                                      <i class="fas fa-unlock text-emerald-600"></i> Desbloquear
                                    </button>
                                  ` : `
                                    <button class="dev-toggle-block-btn px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-800 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1" data-id="${b.id}" data-action="block" data-name="${b.name}" title="Bloquear / Suspender reservas">
                                      <i class="fas fa-ban text-rose-600"></i> Bloquear
                                    </button>
                                  `}

                                  <!-- Eliminar definitivamente -->
                                  <button class="dev-delete-biz-btn p-2 bg-slate-100 hover:bg-rose-600 hover:text-white text-slate-500 rounded-xl transition-all" data-id="${b.id}" data-name="${b.name}" title="Eliminar Comercio Permanentemente">
                                    <i class="fas fa-trash-alt text-xs"></i>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  `}
                </div>
              ` : ''}

              <!-- PESTAÑA 3: USUARIOS / CLIENTES -->
              ${this.activeDevTab === 'clients' ? `
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-base font-bold text-slate-800">Clientes Registrados en la Plataforma</h3>
                      <p class="text-xs text-slate-500">Usuarios finales registrados para reservar citas.</p>
                    </div>
                  </div>

                  ${filteredClients.length === 0 ? `
                    <div class="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400">
                      <i class="fas fa-user-slash text-3xl mb-2"></i>
                      <p class="text-sm font-bold text-slate-700">No hay clientes registrados aún</p>
                    </div>
                  ` : `
                    <div class="overflow-x-auto">
                      <table class="w-full text-left text-xs text-slate-600">
                        <thead class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th class="p-3">Nombre</th>
                            <th class="p-3">Teléfono / WhatsApp</th>
                            <th class="p-3">Correo Electrónico</th>
                            <th class="p-3">Fecha de Registro</th>
                            <th class="p-3">Total Citas</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium">
                          ${filteredClients.map(c => {
                            const regDate = c.createdAt || c.created_at;
                            const count = c.appointmentsCount !== undefined ? c.appointmentsCount : (c.booking_count || 0);

                            return `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                              <td class="p-3">
                                <div class="flex items-center gap-2">
                                  <div class="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                                    ${c.name ? c.name.charAt(0).toUpperCase() : 'U'}
                                  </div>
                                  <div>
                                    <span class="font-bold text-slate-900 block">${c.name}</span>
                                    <span class="text-[10px] text-slate-400 font-mono">ID: ${c.id}</span>
                                  </div>
                                </div>
                              </td>
                              <td class="p-3">
                                <span class="font-semibold text-slate-800">${c.phone || 'N/A'}</span>
                              </td>
                              <td class="p-3">
                                <span class="text-slate-600">${c.email || 'Sin correo'}</span>
                              </td>
                              <td class="p-3 text-slate-500 whitespace-nowrap">
                                ${regDate ? new Date(regDate).toLocaleDateString('es-CR') : 'N/A'}
                              </td>
                              <td class="p-3">
                                <span class="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-bold text-xs">${count}</span>
                              </td>
                            </tr>
                          `}).join('')}
                        </tbody>
                      </table>
                    </div>
                  `}
                </div>
              ` : ''}

              <!-- PESTAÑA 4: CITAS / RESERVAS GLOBALES -->
              ${this.activeDevTab === 'appointments' ? `
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-base font-bold text-slate-800">Reservas Globales Agendadas</h3>
                      <p class="text-xs text-slate-500">Historial en vivo de todas las citas agendadas entre clientes y comercios.</p>
                    </div>
                  </div>

                  ${filteredAppointments.length === 0 ? `
                    <div class="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400">
                      <i class="fas fa-calendar-times text-3xl mb-2"></i>
                      <p class="text-sm font-bold text-slate-700">No hay reservas registradas en el sistema</p>
                    </div>
                  ` : `
                    <div class="overflow-x-auto">
                      <table class="w-full text-left text-xs text-slate-600">
                        <thead class="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th class="p-3">Cliente</th>
                            <th class="p-3">Comercio</th>
                            <th class="p-3">Servicio</th>
                            <th class="p-3">Fecha & Hora</th>
                            <th class="p-3">Monto</th>
                            <th class="p-3">Estado</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium">
                          ${filteredAppointments.map(a => {
                            const cliName = a.clientName || a.client_name || 'Cliente';
                            const cliPhone = a.clientPhone || a.client_phone || '';
                            const bizName = a.businessName || a.business_name || 'Comercio';
                            const srvName = a.serviceName || a.service_name || 'Servicio';
                            const price = a.servicePrice !== undefined ? a.servicePrice : (a.price || a.service_price || 0);

                            return `
                            <tr class="hover:bg-slate-50/80 transition-colors">
                              <td class="p-3">
                                <span class="font-bold text-slate-900 block">${cliName}</span>
                                <span class="text-[10px] text-slate-400">${cliPhone}</span>
                              </td>
                              <td class="p-3">
                                <span class="font-bold text-slate-800 block">${bizName}</span>
                              </td>
                              <td class="p-3">
                                <span class="text-slate-800 font-medium block">${srvName}</span>
                              </td>
                              <td class="p-3 whitespace-nowrap">
                                <span class="font-bold text-slate-800 block">${a.date}</span>
                                <span class="font-bold text-slate-800 block">${this.formatDateDMY(a.date)}</span>
                                <span class="text-[10px] text-blue-600 font-bold">${this.formatTime12h(a.time)}</span>
                              </td>
                              <td class="p-3 font-bold text-slate-900">
                                ${this.formatColones(price)}
                              </td>
                              <td class="p-3">
                                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
                                  a.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' :
                                  a.status === 'cancelled' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                }">
                                  ${a.status === 'confirmed' ? 'Confirmada' : a.status === 'cancelled' ? 'Cancelada' : 'Pendiente'}
                                </span>
                              </td>
                            </tr>
                          `}).join('')}
                        </tbody>
                      </table>
                    </div>
                  `}
                </div>
              ` : ''}

            </div>
          </div>
        </div>
      `;

      // Event Listeners del Panel Developer
      document.getElementById('dev-logout-view-btn')?.addEventListener('click', () => {
        storage.logoutDeveloper();
        this.showToast('Sesión de Developer cerrada.', 'info');
        this.renderHeader();
        this.navigateTo('directory');
      });

      // Tabs Switch
      document.getElementById('dev-tab-alerts')?.addEventListener('click', () => {
        this.activeDevTab = 'alerts';
        this.renderDeveloperDashboardView(container);
      });
      document.getElementById('dev-tab-businesses')?.addEventListener('click', () => {
        this.activeDevTab = 'businesses';
        this.renderDeveloperDashboardView(container);
      });
      document.getElementById('dev-tab-clients')?.addEventListener('click', () => {
        this.activeDevTab = 'clients';
        this.renderDeveloperDashboardView(container);
      });
      document.getElementById('dev-tab-appointments')?.addEventListener('click', () => {
        this.activeDevTab = 'appointments';
        this.renderDeveloperDashboardView(container);
      });

      // Subfiltros de negocios
      document.querySelectorAll('.dev-biz-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.devBizFilter = e.currentTarget.getAttribute('data-filter') || 'all';
          this.renderDeveloperDashboardView(container);
        });
      });

      // Buscador
      const searchInput = document.getElementById('dev-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.devSearchQuery = e.target.value;
          this.renderDeveloperDashboardView(container);
        });
        if (this.devSearchQuery) {
          searchInput.focus();
          searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        }
      }

      // Descartar/Revisar alerta
      document.querySelectorAll('.dismiss-alert-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const alertId = e.currentTarget.getAttribute('data-id');
          if (alertId) {
            await storage.dismissCategoryAlert(alertId);
            this.showToast('Alerta marcada como revisada.', 'success');
            this.renderDeveloperDashboardView(container);
          }
        });
      });

      // Ver negocio en directorio
      document.querySelectorAll('.dev-view-biz-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const bizId = e.currentTarget.getAttribute('data-id');
          if (bizId) {
            this.navigateTo('business-detail', { businessId: bizId });
          }
        });
      });

      // Ocultar / Mostrar en la página principal
      document.querySelectorAll('.dev-toggle-visibility-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const bizId = e.currentTarget.getAttribute('data-id');
          const action = e.currentTarget.getAttribute('data-action');
          const bizName = e.currentTarget.getAttribute('data-name');
          const shouldHide = action === 'hide';

          try {
            await storage.toggleBusinessVisibility(bizId, shouldHide);
            this.showToast(
              shouldHide 
                ? `El comercio "${bizName}" ha sido ocultado de la página principal.` 
                : `El comercio "${bizName}" ahora es visible en la página principal.`,
              'success'
            );
            this.renderDeveloperDashboardView(container);
          } catch (err) {
            this.showToast(err.message || 'Error al actualizar visibilidad.', 'error');
          }
        });
      });

      // Bloquear / Desbloquear comercio
      document.querySelectorAll('.dev-toggle-block-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const bizId = e.currentTarget.getAttribute('data-id');
          const action = e.currentTarget.getAttribute('data-action');
          const bizName = e.currentTarget.getAttribute('data-name');

          if (action === 'block') {
            const reason = prompt(`¿Motivo de suspensión/bloqueo para "${bizName}"? (opcional):`, 'Suspensión administrativa temporal');
            if (reason !== null) {
              try {
                await storage.toggleBusinessBlock(bizId, true, reason);
                this.showToast(`El comercio "${bizName}" ha sido BLOQUEADO/SUSPENDIDO.`, 'warning');
                this.renderDeveloperDashboardView(container);
              } catch (err) {
                this.showToast(err.message || 'Error al bloquear comercio.', 'error');
              }
            }
          } else {
            if (confirm(`¿Deseas desbloquear el comercio "${bizName}" para que vuelva a recibir reservas?`)) {
              try {
                await storage.toggleBusinessBlock(bizId, false, '');
                this.showToast(`El comercio "${bizName}" ha sido DESBLOQUEADO exitosamente.`, 'success');
                this.renderDeveloperDashboardView(container);
              } catch (err) {
                this.showToast(err.message || 'Error al desbloquear comercio.', 'error');
              }
            }
          }
        });
      });

      // Eliminar negocio
      document.querySelectorAll('.dev-delete-biz-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const bizId = e.currentTarget.getAttribute('data-id');
          const bizName = e.currentTarget.getAttribute('data-name');
          if (confirm(`⚠️ ATENCIÓN: ¿Estás seguro de que deseas ELIMINAR PERMANENTEMENTE el negocio "${bizName}"?\n\nEsta acción borrará todos sus servicios, citas asociadas y usuarios en la base de datos.`)) {
            try {
              await storage.deleteBusinessByDeveloper(bizId);
              this.showToast(`Negocio "${bizName}" eliminado definitivamente.`, 'success');
              this.renderDeveloperDashboardView(container);
            } catch (err) {
              this.showToast(err.message || 'Error al eliminar.', 'error');
            }
          }
        });
      });

    } catch (err) {
      console.error(err);
      container.innerHTML = `
        <div class="max-w-md mx-auto my-16 p-8 bg-white rounded-3xl border border-rose-200 text-center shadow-lg">
          <i class="fas fa-exclamation-triangle text-3xl text-rose-500 mb-3"></i>
          <h2 class="text-lg font-bold text-slate-800 mb-1">Error al cargar datos</h2>
          <p class="text-xs text-slate-500 mb-4">${err.message || 'No se pudo conectar con el servidor.'}</p>
          <button id="dev-retry-btn" class="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-md">Reintentar</button>
        </div>
      `;
      document.getElementById('dev-retry-btn')?.addEventListener('click', () => this.renderDeveloperDashboardView(container));
    }
  }

  // ==========================================
  // MODAL INTEGRADO DE AUTENTICACIÓN (LOGIN & REGISTRO)
  // ==========================================
  renderAuthModal({ mode = 'login', role = 'client' } = {}) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const currentClient = storage.getClientUser();
    const categories = storage.getCategories().filter(c => c.id !== 'all');

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-2xl ${role === 'business' && mode === 'register' ? 'max-w-xl' : 'max-w-md'} w-full overflow-hidden border border-slate-200 my-8 max-h-[92vh] flex flex-col">
          
          <!-- Header del Modal -->
          <div class="bg-slate-900 p-5 text-white flex items-center justify-between shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl ${role === 'business' ? 'bg-indigo-600' : 'bg-blue-600'} flex items-center justify-center text-white text-lg shadow-sm">
                <i class="fas ${role === 'business' ? 'fa-store' : 'fa-user-check'}"></i>
              </div>
              <div>
                <span class="text-[11px] uppercase tracking-wider ${role === 'business' ? 'text-indigo-300' : 'text-blue-300'} font-bold">
                  ${mode === 'login' ? 'Acceso Seguro' : 'Registro de Cuenta'}
                </span>
                <h3 class="text-base sm:text-lg font-bold">
                  ${mode === 'login' ? (role === 'business' ? 'Iniciar Sesión Negocio' : 'Iniciar Sesión Usuario') : (role === 'business' ? 'Registrar mi Negocio' : 'Crear Cuenta de Usuario')}
                </h3>
              </div>
            </div>
            <button id="close-auth-modal-btn" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
              <i class="fas fa-times text-sm"></i>
            </button>
          </div>

          <!-- Pestañas de Modo (Iniciar Sesión / Registrarse) y Selección de Rol (Cliente / Negocio) -->
          <div class="p-5 pb-0 shrink-0 space-y-3 bg-slate-50 border-b border-slate-200/80">
            <!-- Tabs Modo: Iniciar Sesión / Registrarse -->
            <div class="flex p-1 bg-slate-200/80 rounded-2xl">
              <button id="tab-mode-login" class="flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}">
                <i class="fas fa-sign-in-alt text-xs ${mode === 'login' ? 'text-blue-600' : ''}"></i> Iniciar Sesión
              </button>
              <button id="tab-mode-register" class="flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}">
                <i class="fas fa-user-plus text-xs ${mode === 'register' ? 'text-blue-600' : ''}"></i> Registrarse
              </button>
            </div>

            <!-- Tabs Rol: Cliente / Negocio -->
            <div class="flex gap-2 pb-3">
              <button id="tab-role-client" class="flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${role === 'client' ? 'bg-blue-600 border-blue-600 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}">
                <i class="fas fa-user text-xs"></i> Soy Cliente
              </button>
              <button id="tab-role-business" class="flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${role === 'business' ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}">
                <i class="fas fa-store text-xs"></i> Soy Negocio / Dueño
              </button>
            </div>
          </div>

          <!-- Cuerpo con Formularios Dinámicos -->
          <div class="p-6 space-y-4 overflow-y-auto flex-1">
            ${mode === 'login' && role === 'client' ? `
              <!-- FORM 1: LOGIN CLIENTE (TELÉFONO/CORREO Y CONTRASEÑA) -->
              <p class="text-xs text-slate-500">Ingresa con tu teléfono o correo y tu contraseña para gestionar tus citas.</p>
              
              <div id="cli-log-inline-error" class="hidden p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2"></div>

              <form id="auth-client-login-form" class="space-y-4 text-xs sm:text-sm">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Teléfono o Correo Electrónico *</label>
                  <input type="text" id="cli-log-identifier" required placeholder="Ej. +506 8888 7777 o juan@correo.com" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <div>
                  <label class="block font-bold text-slate-700 mb-1">Contraseña *</label>
                  <input type="password" id="cli-log-password" required placeholder="••••••••" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <button type="submit" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                  <i class="fas fa-sign-in-alt"></i>
                  <span>Iniciar Sesión como Cliente</span>
                </button>
              </form>
            ` : ''}

            ${mode === 'login' && role === 'business' ? `
              <!-- FORM 2: LOGIN NEGOCIO (CORREO Y CONTRASEÑA) -->
              <p class="text-xs text-slate-500">Ingresa tus credenciales para administrar tus citas, servicios, precios, fotos y horarios.</p>
              
              <div id="biz-log-inline-error" class="hidden p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2"></div>

              <form id="auth-biz-login-form" class="space-y-4 text-xs sm:text-sm">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Correo Electrónico del Negocio *</label>
                  <input type="email" id="biz-log-email" required placeholder="correo@tucomercio.cr" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                </div>

                <div>
                  <label class="block font-bold text-slate-700 mb-1">Contraseña *</label>
                  <input type="password" id="biz-log-password" required placeholder="••••••••" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                </div>

                <button type="submit" class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2">
                  <i class="fas fa-sign-in-alt"></i>
                  <span>Ingresar al Panel de Negocio</span>
                </button>
              </form>

              <!-- Acceso Rápido Demo -->
              <div class="pt-4 border-t border-slate-100">
                <span class="text-[11px] font-bold text-slate-400 uppercase block mb-2">⚡ Acceso Rápido a Comercios de Muestra (1-Clic)</span>
                <div class="grid grid-cols-2 gap-2">
                  <button type="button" class="quick-demo-btn p-2 text-left rounded-xl border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-xs text-slate-700 transition-colors" data-email="barberia@demo.cr" data-pass="123">
                    <span class="font-bold block truncate">Barbería Vintage</span>
                    <span class="text-[10px] text-slate-400">barberia@demo.cr</span>
                  </button>
                  <button type="button" class="quick-demo-btn p-2 text-left rounded-xl border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-xs text-slate-700 transition-colors" data-email="dental@demo.cr" data-pass="123">
                    <span class="font-bold block truncate">Clínica Dental</span>
                    <span class="text-[10px] text-slate-400">dental@demo.cr</span>
                  </button>
                  <button type="button" class="quick-demo-btn p-2 text-left rounded-xl border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-xs text-slate-700 transition-colors" data-email="spa@demo.cr" data-pass="123">
                    <span class="font-bold block truncate">Serenity Spa</span>
                    <span class="text-[10px] text-slate-400">spa@demo.cr</span>
                  </button>
                  <button type="button" class="quick-demo-btn p-2 text-left rounded-xl border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-xs text-slate-700 transition-colors" data-email="taller@demo.cr" data-pass="123">
                    <span class="font-bold block truncate">AutoCheck Taller</span>
                    <span class="text-[10px] text-slate-400">taller@demo.cr</span>
                  </button>
                </div>
              </div>
            ` : ''}

            ${mode === 'register' && role === 'client' ? `
              <!-- FORM 3: REGISTRO CLIENTE (CON CONTRASEÑA Y CONFIRMACIÓN) -->
              <p class="text-xs text-slate-500">Crea tu cuenta de cliente con contraseña segura para gestionar tus reservas en Costa Rica.</p>
              
              <form id="auth-client-reg-form" class="space-y-4 text-xs sm:text-sm">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Nombre Completo *</label>
                  <input type="text" id="cli-reg-name" required placeholder="Ej. Juan Pérez" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Teléfono / WhatsApp (+506) *</label>
                    <input type="tel" id="cli-reg-phone" required placeholder="Ej. +506 8888 7777" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  </div>
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Correo Electrónico (Opcional)</label>
                    <input type="email" id="cli-reg-email" placeholder="juan@correo.com" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Crear Contraseña *</label>
                    <input type="password" id="cli-reg-password" required minlength="6" placeholder="Mínimo 6 caracteres" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all">
                  </div>
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Confirmar Contraseña *</label>
                    <input type="password" id="cli-reg-password-confirm" required minlength="6" placeholder="Repite tu contraseña" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all">
                  </div>
                </div>

                <!-- Mensaje Inline de Validación de Contraseñas (Aparece aquí mismo) -->
                <div id="cli-reg-inline-error" class="hidden p-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"></div>

                <!-- Consentimiento previo (Opt-in) WhatsApp -->
                <div class="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl">
                  <label class="flex items-start gap-3 cursor-pointer select-none">
                    <input type="checkbox" id="cli-reg-whatsapp-optin" checked class="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-emerald-300">
                    <div class="text-xs text-slate-700 leading-relaxed">
                      <div class="font-bold text-emerald-800 flex items-center gap-1.5 mb-0.5">
                        <i class="fab fa-whatsapp text-emerald-600 text-sm"></i>
                        <span>Notificaciones de Citas por WhatsApp (Opt-in)</span>
                      </div>
                      <p class="text-slate-600 text-[11px]">
                        Acepto recibir mensajes de confirmación de mis reservas y recordatorios de turnos vía WhatsApp a mi número telefónico.
                      </p>
                    </div>
                  </label>
                </div>

                <button type="submit" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
                  <i class="fas fa-user-plus"></i>
                  <span>Crear Cuenta de Cliente</span>
                </button>
              </form>
            ` : ''}

            ${mode === 'register' && role === 'business' ? `
              <!-- FORM 4: REGISTRO NUEVO NEGOCIO -->
              <form id="auth-biz-reg-form" class="space-y-4 text-xs sm:text-sm">
                <!-- Cuenta de Usuario / Credenciales -->
                <div class="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-3">
                  <span class="font-bold text-indigo-900 block text-xs uppercase tracking-wider">
                    <i class="fas fa-lock mr-1"></i> Credenciales de Acceso para el Dueño
                  </span>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block font-bold text-slate-700 mb-1">Nombre del Administrador *</label>
                      <input type="text" id="reg-owner-name" required placeholder="Ej. Carlos Rodríguez" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium">
                    </div>
                    <div>
                      <label class="block font-bold text-slate-700 mb-1">Correo para Iniciar Sesión *</label>
                      <input type="email" id="reg-biz-email" required placeholder="admin@comercio.cr" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium">
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block font-bold text-slate-700 mb-1">Crea una Contraseña *</label>
                      <input type="password" id="reg-biz-password" required placeholder="Mínimo 6 caracteres" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                      <input type="password" id="reg-biz-password" required placeholder="Mínimo 6 caracteres" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all">
                    </div>
                    <div>
                      <label class="block font-bold text-slate-700 mb-1">Confirmar Contraseña *</label>
                      <input type="password" id="reg-biz-password-confirm" required placeholder="Repite tu contraseña" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                      <input type="password" id="reg-biz-password-confirm" required placeholder="Repite tu contraseña" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all">
                    </div>
                  </div>

                  <!-- Mensaje Inline de Validación de Contraseñas (Aparece aquí mismo) -->
                  <div id="biz-reg-inline-error" class="hidden p-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"></div>
                </div>

                <!-- Datos Comerciales -->
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Nombre Comercial del Negocio *</label>
                  <input type="text" id="new-biz-name" required placeholder="Ej. Barbería Costa Rica, Clínica Dental..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Categoría *</label>
                    <label class="block font-bold text-slate-700 mb-1">Categoría del Negocio *</label>
                    <select id="new-biz-cat" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                      <option value="belleza">Belleza y Barbería</option>
                      <option value="salud">Salud y Bienestar</option>
                      <option value="spa">Spa y Masajes</option>
                      <option value="fitness">Fitness y Deporte</option>
                      <option value="autos">Talleres y Autos</option>
                      <option value="fotografia">Fotografía y Eventos</option>
                      ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                      <option value="otra" class="font-bold text-blue-600">➕ Otra Categoría (Personalizada)</option>
                    </select>
                  </div>

                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Provincia / Cantón *</label>
                    <input type="text" id="new-biz-city" required placeholder="Ej. San José, Escazú / Heredia..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  </div>
                </div>

                <!-- Caja para Categoría Personalizada (Aparece al seleccionar 'Otra Categoría') -->
                <div id="new-biz-custom-cat-box" class="hidden p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl animate-fade-in space-y-1">
                  <div class="flex items-center justify-between">
                    <label class="block text-xs font-bold text-blue-900">Escribe el Nombre de tu Nueva Categoría *</label>
                    <span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Notificará al Developer</span>
                  </div>
                  <input type="text" id="new-biz-custom-cat" placeholder="Ej. Jardinería, Clases de Música, Lavado de Muebles..." class="w-full px-3.5 py-2 bg-white border border-blue-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Teléfono / WhatsApp (+506) *</label>
                    <input type="tel" id="new-biz-phone" required placeholder="+506 8888 7777" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  </div>
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Dirección Exacta</label>
                    <input type="text" id="new-biz-address" placeholder="100m Oeste del Parque..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  </div>
                </div>

                <div>
                  <label class="block font-bold text-slate-700 mb-1">Descripción</label>
                  <textarea id="new-biz-desc" rows="2" placeholder="Describe brevemente tus especialidades..." class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"></textarea>
                </div>

                <!-- Fotos con Guía de Medidas -->
                <div class="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl space-y-3">
                  <span class="font-bold text-blue-900 block text-xs uppercase tracking-wider">
                    <i class="fas fa-camera mr-1"></i> Fotos del Comercio (Guía de Medidas)
                  </span>

                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-xs font-bold text-slate-700">Logo / Foto de Perfil</label>
                      <span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Medida: 800 x 800 px (1:1)</span>
                    </div>
                    <input type="text" id="new-biz-image" placeholder="URL de imagen cuadrada" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
                  </div>

                  <div>
                    <div class="flex items-center justify-between mb-1">
                      <label class="text-xs font-bold text-slate-700">Banner / Foto de Portada</label>
                      <span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Medida: 1200 x 450 px (16:6)</span>
                    </div>
                    <input type="text" id="new-biz-cover" placeholder="URL del banner panorámico" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
                  </div>
                </div>

                <!-- Primer Servicio -->
                <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                  <span class="font-bold text-slate-800 block text-xs uppercase tracking-wider">
                    <i class="fas fa-tag mr-1 text-emerald-600"></i> Primer Servicio
                  </span>

                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div class="sm:col-span-2">
                      <input type="text" id="first-srv-name" required placeholder="Nombre del servicio (Ej. Corte Clásico)" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
                    </div>
                    <div>
                      <input type="number" id="first-srv-price" required min="0" step="500" placeholder="Precio ₡ CRC" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold">
                    </div>
                  </div>
                </div>

                <button type="submit" class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/25 transition-all text-sm flex items-center justify-center gap-2">
                  <i class="fas fa-check-circle"></i>
                  <span>Crear Cuenta y Registrar Negocio</span>
                </button>
              </form>
            ` : ''}

            <!-- Enlace sutil para Developer -->
            <div class="pt-3 text-center border-t border-slate-100">
              <button type="button" id="modal-dev-link-btn" class="text-[11px] text-slate-400 hover:text-slate-600 font-medium transition-colors">
                <i class="fas fa-terminal text-[10px] mr-1"></i> Acceso Developer (Ctrl+Shift+D)
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Cerrar modal
    document.getElementById('close-auth-modal-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    // Enlace Developer en el pie del modal
    document.getElementById('modal-dev-link-btn')?.addEventListener('click', () => {
      this.renderDeveloperQuickLoginModal();
    });

    // Pestañas de Modo (Login / Register)
    document.getElementById('tab-mode-login')?.addEventListener('click', () => {
      this.renderAuthModal({ mode: 'login', role });
    });
    document.getElementById('tab-mode-register')?.addEventListener('click', () => {
      this.renderAuthModal({ mode: 'register', role });
    });

    // Pestañas de Rol (Cliente / Negocio)
    document.getElementById('tab-role-client')?.addEventListener('click', () => {
      this.renderAuthModal({ mode, role: 'client' });
    });
    document.getElementById('tab-role-business')?.addEventListener('click', () => {
      this.renderAuthModal({ mode, role: 'business' });
    });

    // Toggle de Categoría Personalizada en Registro de Negocio
    const bizCatSelect = document.getElementById('new-biz-cat');
    const customCatBox = document.getElementById('new-biz-custom-cat-box');
    bizCatSelect?.addEventListener('change', () => {
      if (bizCatSelect.value === 'otra') {
        customCatBox?.classList.remove('hidden');
        document.getElementById('new-biz-custom-cat')?.focus();
      } else {
        customCatBox?.classList.add('hidden');
      }
    });

    // Demo Buttons (en login de negocio)
    document.querySelectorAll('.quick-demo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const emailInput = document.getElementById('biz-log-email');
        const passInput = document.getElementById('biz-log-password');
        if (emailInput && passInput) {
          emailInput.value = btn.getAttribute('data-email');
          passInput.value = btn.getAttribute('data-pass');
          document.getElementById('auth-biz-login-form')?.dispatchEvent(new Event('submit'));
        }
      });
    });

    // Real-time password validation for Client Registration
    const cliRegPass = document.getElementById('cli-reg-password');
    const cliRegPassConf = document.getElementById('cli-reg-password-confirm');
    const cliRegErrBox = document.getElementById('cli-reg-inline-error');

    const checkCliPasswordsMatch = () => {
      if (!cliRegPass || !cliRegPassConf || !cliRegErrBox) return true;
      const p1 = cliRegPass.value;
      const p2 = cliRegPassConf.value;

      if (!p1 && !p2) {
        cliRegErrBox.className = 'hidden';
        cliRegPass.classList.remove('border-rose-500', 'bg-rose-50/20', 'border-emerald-500', 'bg-emerald-50/20');
        cliRegPassConf.classList.remove('border-rose-500', 'bg-rose-50/20', 'border-emerald-500', 'bg-emerald-50/20');
        return true;
      }

      if (p2.length > 0 && p1 !== p2) {
        cliRegErrBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
        cliRegErrBox.innerHTML = '<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>Las contraseñas no coinciden. Por favor verifícalas.</span>';
        cliRegPassConf.classList.add('border-rose-500', 'bg-rose-50/20');
        cliRegPassConf.classList.remove('border-emerald-500', 'bg-emerald-50/20');
        return false;
      } else if (p1.length >= 6 && p1 === p2) {
        cliRegErrBox.className = 'p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
        cliRegErrBox.innerHTML = '<i class="fas fa-check-circle text-emerald-600 text-sm flex-shrink-0"></i> <span>¡Las contraseñas coinciden!</span>';
        cliRegPass.classList.remove('border-rose-500', 'bg-rose-50/20');
        cliRegPass.classList.add('border-emerald-500', 'bg-emerald-50/20');
        cliRegPassConf.classList.remove('border-rose-500', 'bg-rose-50/20');
        cliRegPassConf.classList.add('border-emerald-500', 'bg-emerald-50/20');
        return true;
      } else if (p1.length > 0 && p1.length < 6) {
        cliRegErrBox.className = 'p-2.5 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
        cliRegErrBox.innerHTML = '<i class="fas fa-info-circle text-amber-600 text-sm flex-shrink-0"></i> <span>La contraseña debe tener al menos 6 caracteres.</span>';
        return false;
      } else {
        cliRegErrBox.className = 'hidden';
        cliRegPass.classList.remove('border-rose-500', 'bg-rose-50/20');
        cliRegPassConf.classList.remove('border-rose-500', 'bg-rose-50/20');
        return true;
      }
    };

    cliRegPass?.addEventListener('input', checkCliPasswordsMatch);
    cliRegPassConf?.addEventListener('input', checkCliPasswordsMatch);

    // Real-time password validation for Business Registration
    const bizRegPass = document.getElementById('reg-biz-password');
    const bizRegPassConf = document.getElementById('reg-biz-password-confirm');
    const bizRegErrBox = document.getElementById('biz-reg-inline-error');

    const checkBizPasswordsMatch = () => {
      if (!bizRegPass || !bizRegPassConf || !bizRegErrBox) return true;
      const p1 = bizRegPass.value;
      const p2 = bizRegPassConf.value;

      if (!p1 && !p2) {
        bizRegErrBox.className = 'hidden';
        bizRegPass.classList.remove('border-rose-500', 'bg-rose-50/20', 'border-emerald-500', 'bg-emerald-50/20');
        bizRegPassConf.classList.remove('border-rose-500', 'bg-rose-50/20', 'border-emerald-500', 'bg-emerald-50/20');
        return true;
      }

      if (p2.length > 0 && p1 !== p2) {
        bizRegErrBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
        bizRegErrBox.innerHTML = '<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>Las contraseñas no coinciden. Por favor verifícalas.</span>';
        bizRegPassConf.classList.add('border-rose-500', 'bg-rose-50/20');
        bizRegPassConf.classList.remove('border-emerald-500', 'bg-emerald-50/20');
        return false;
      } else if (p1.length >= 6 && p1 === p2) {
        bizRegErrBox.className = 'p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
        bizRegErrBox.innerHTML = '<i class="fas fa-check-circle text-emerald-600 text-sm flex-shrink-0"></i> <span>¡Las contraseñas coinciden!</span>';
        bizRegPass.classList.remove('border-rose-500', 'bg-rose-50/20');
        bizRegPass.classList.add('border-emerald-500', 'bg-emerald-50/20');
        bizRegPassConf.classList.remove('border-rose-500', 'bg-rose-50/20');
        bizRegPassConf.classList.add('border-emerald-500', 'bg-emerald-50/20');
        return true;
      } else if (p1.length > 0 && p1.length < 6) {
        bizRegErrBox.className = 'p-2.5 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
        bizRegErrBox.innerHTML = '<i class="fas fa-info-circle text-amber-600 text-sm flex-shrink-0"></i> <span>La contraseña debe tener al menos 6 caracteres.</span>';
        return false;
      } else {
        bizRegErrBox.className = 'hidden';
        bizRegPass.classList.remove('border-rose-500', 'bg-rose-50/20');
        bizRegPassConf.classList.remove('border-rose-500', 'bg-rose-50/20');
        return true;
      }
    };

    bizRegPass?.addEventListener('input', checkBizPasswordsMatch);
    bizRegPassConf?.addEventListener('input', checkBizPasswordsMatch);

    // Evento Submit: Login Cliente
    // Evento Submit: Login Cliente (detecta Developer)
    // Evento Submit: Login Cliente (detecta Developer y Negocio)
    document.getElementById('auth-client-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('cli-log-identifier').value.trim();
      const password = document.getElementById('cli-log-password').value;
      const errBox = document.getElementById('cli-log-inline-error');

      try {
        if (errBox) errBox.className = 'hidden';
        await storage.loginClient(identifier, password);
        const res = await storage.loginClient(identifier, password);
        
        if (res && res.role === 'developer') {
          this.showToast('¡Modo SuperAdmin Developer activado!', 'success');
          modalContainer.innerHTML = '';
          this.renderHeader();
          this.navigateTo('developer-dashboard');
          return;
        }

        if (res && res.role === 'business') {
          this.showToast('¡Bienvenido a tu panel de administración!', 'success');
          modalContainer.innerHTML = '';
          this.renderHeader();
          this.navigateTo('owner-dashboard');
          return;
        }

        this.showToast('¡Bienvenido(a)! Sesión iniciada como cliente.', 'success');
        modalContainer.innerHTML = '';
        this.renderHeader();
        this.renderCurrentView();
      } catch (err) {
        this.showToast(err.message || 'Error al iniciar sesión.', 'error');
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in mb-3';
          errBox.innerHTML = `<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>${err.message || 'Error al iniciar sesión.'}</span>`;
        } else {
          this.showToast(err.message || 'Error al iniciar sesión.', 'error');
        }
      }
    });

    // Evento Submit: Registro Cliente (con validación de contraseña y confirmación)
    // Evento Submit: Registro Cliente (con validación inline de contraseña y confirmación)
    // Evento Submit: Registro Cliente
    document.getElementById('auth-client-reg-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('cli-reg-name').value.trim();
      const phone = document.getElementById('cli-reg-phone').value.trim();
      const email = document.getElementById('cli-reg-email').value.trim();
      const password = document.getElementById('cli-reg-password').value;
      const passwordConfirm = document.getElementById('cli-reg-password-confirm').value;
      const errBox = document.getElementById('cli-reg-inline-error');

      if (password.length < 6) {
        this.showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
          errBox.innerHTML = '<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>La contraseña debe tener al menos 6 caracteres.</span>';
        }
        document.getElementById('cli-reg-password').focus();
        return;
      }

      if (password !== passwordConfirm) {
        this.showToast('Las contraseñas no coinciden. Por favor verifícalas.', 'error');
        document.getElementById('cli-reg-password-confirm').focus();
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
          errBox.innerHTML = '<i class="fas fa-exclamation-triangle text-rose-600 text-sm flex-shrink-0"></i> <span>Las contraseñas no coinciden. Por favor verifícalas aquí arriba.</span>';
        }
        const confirmInput = document.getElementById('cli-reg-password-confirm');
        confirmInput.classList.add('border-rose-500', 'bg-rose-50/20');
        confirmInput.focus();
        return;
      }

      const whatsappOptIn = document.getElementById('cli-reg-whatsapp-optin')?.checked ?? true;

      try {
        await storage.registerClient(name, phone, email, password, whatsappOptIn);
        this.showToast('¡Cuenta de cliente creada exitosamente!', 'success');
        modalContainer.innerHTML = '';
        this.renderHeader();
        this.renderCurrentView();
      } catch (err) {
        this.showToast(err.message || 'Error al registrarse.', 'error');
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
          errBox.innerHTML = `<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>${err.message || 'Error al registrarse.'}</span>`;
        } else {
          this.showToast(err.message || 'Error al registrarse.', 'error');
        }
      }
    });

    // Evento Submit: Login Negocio
    // Evento Submit: Login Negocio (detecta Developer)
    // Evento Submit: Login Negocio (detecta Developer y Cliente)
    document.getElementById('auth-biz-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('biz-log-email').value;
      const password = document.getElementById('biz-log-password').value;
      const errBox = document.getElementById('biz-log-inline-error');

      try {
        if (errBox) errBox.className = 'hidden';
        await storage.loginBusiness(email, password);
        const res = await storage.loginBusiness(email, password);

        if (res && res.role === 'developer') {
          this.showToast('¡Modo SuperAdmin Developer activado!', 'success');
          modalContainer.innerHTML = '';
          this.renderHeader();
          this.navigateTo('developer-dashboard');
          return;
        }

        if (res && res.role === 'client') {
          this.showToast('¡Bienvenido(a)! Sesión iniciada como cliente.', 'success');
          modalContainer.innerHTML = '';
          this.renderHeader();
          this.navigateTo('my-client-bookings');
          return;
        }

        this.showToast('¡Bienvenido a tu panel de administración!', 'success');
        modalContainer.innerHTML = '';
        this.renderHeader();
        this.navigateTo('owner-dashboard');
      } catch (err) {
        this.showToast(err.message || 'Error al iniciar sesión.', 'error');
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in mb-3';
          errBox.innerHTML = `<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>${err.message || 'Error al iniciar sesión.'}</span>`;
        } else {
          this.showToast(err.message || 'Error al iniciar sesión.', 'error');
        }
      }
    });

    // Evento Submit: Registro Negocio (Valida contraseñas coincidentes)
    // Evento Submit: Registro Negocio (Valida contraseñas coincidentes inline)
    // Evento Submit: Registro Negocio (Valida contraseñas coincidentes y categoría personalizada)
    // Evento Submit: Registro Negocio
    document.getElementById('auth-biz-reg-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ownerName = document.getElementById('reg-owner-name').value;
      const email = document.getElementById('reg-biz-email').value;
      const password = document.getElementById('reg-biz-password').value;
      const passwordConfirm = document.getElementById('reg-biz-password-confirm').value;
      const name = document.getElementById('new-biz-name').value;
      const catSelectVal = document.getElementById('new-biz-cat').value;
      const city = document.getElementById('new-biz-city').value;
      const phone = document.getElementById('new-biz-phone').value;
      const address = document.getElementById('new-biz-address').value;
      const description = document.getElementById('new-biz-desc').value;
      const image = document.getElementById('new-biz-image').value;
      const coverImage = document.getElementById('new-biz-cover').value;
      const firstSrvName = document.getElementById('first-srv-name').value;
      const firstSrvPrice = document.getElementById('first-srv-price').value;
      const errBox = document.getElementById('biz-reg-inline-error');

      if (password.length < 6) {
        this.showToast('La contraseña debe tener al menos 6 caracteres.', 'error');
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
          errBox.innerHTML = '<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>La contraseña debe tener al menos 6 caracteres.</span>';
        }
        document.getElementById('reg-biz-password').focus();
        return;
      }

      if (password !== passwordConfirm) {
        this.showToast('Las contraseñas no coinciden. Por favor verifícalas.', 'error');
        document.getElementById('reg-biz-password-confirm').focus();
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
          errBox.innerHTML = '<i class="fas fa-exclamation-triangle text-rose-600 text-sm flex-shrink-0"></i> <span>Las contraseñas no coinciden. Por favor verifícalas aquí arriba.</span>';
        }
        const confirmInput = document.getElementById('reg-biz-password-confirm');
        confirmInput.classList.add('border-rose-500', 'bg-rose-50/20');
        confirmInput.focus();
        return;
      }

      const catLabels = {
        belleza: 'Belleza y Barbería',
        salud: 'Salud y Bienestar',
        spa: 'Spa y Masajes',
        fitness: 'Fitness y Deporte',
        autos: 'Talleres y Autos',
        fotografia: 'Fotografía y Eventos'
      };
      // Procesar Categoría (Estándar o Personalizada)
      let finalCategory = catSelectVal;
      let categoryLabel = '';
      let isCustomCategory = false;

      if (catSelectVal === 'otra') {
        const customName = document.getElementById('new-biz-custom-cat')?.value.trim();
        if (!customName) {
          this.showToast('Por favor escribe el nombre de tu categoría personalizada.', 'error');
          document.getElementById('new-biz-custom-cat')?.focus();
          return;
        }
        finalCategory = customName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        if (!finalCategory) finalCategory = `cat-${Date.now()}`;
        categoryLabel = customName;
        isCustomCategory = true;
      } else {
        const catObj = storage.getCategories().find(c => c.id === catSelectVal);
        categoryLabel = catObj ? catObj.name : (catLabels[catSelectVal] || catSelectVal);
      }

      try {
        await storage.registerBusinessWithUser(ownerName, email, password, {
          name,
          category: finalCategory,
          categoryLabel,
          isCustomCategory,
          city,
          phone,
          email,
          address,
          description,
          image: image || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
          coverImage: coverImage || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
          isDemo: false,
          features: ['Sinpe Móvil', 'Atención Personalizada'],
          services: [
            { name: firstSrvName, duration: 30, price: parseFloat(firstSrvPrice) || 10000, description: 'Servicio principal.' }
          ]
        });

        this.showToast('¡Negocio y cuenta creados exitosamente!', 'success');
        modalContainer.innerHTML = '';
        this.renderHeader();
        this.navigateTo('owner-dashboard');
      } catch (err) {
        this.showToast(err.message || 'Error al registrar negocio.', 'error');
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
          errBox.innerHTML = `<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>${err.message || 'Error al registrar negocio.'}</span>`;
        } else {
          this.showToast(err.message || 'Error al registrar negocio.', 'error');
        }
      }
    });
  }

  // --- MODAL RÁPIDO DE ACCESO DEVELOPER ---
  renderDeveloperQuickLoginModal() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in">
        <div class="bg-slate-950 text-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-800 my-8">
          <div class="p-6 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center text-lg font-black shadow-md">
                <i class="fas fa-shield-alt"></i>
              </div>
              <div>
                <span class="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Consola Maestra</span>
                <h3 class="text-base font-bold text-white">Acceso Developer</h3>
              </div>
            </div>
            <button id="close-dev-modal-btn" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
              <i class="fas fa-times text-xs"></i>
            </button>
          </div>

          <form id="dev-quick-login-form" class="p-6 space-y-4 text-xs">
            <div>
              <label class="block font-bold text-slate-300 mb-1">Correo de Desarrollador</label>
              <input type="text" id="dev-log-email" value="admin@reservas.cr" required class="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:border-amber-500 focus:outline-none">
            </div>

            <div>
              <label class="block font-bold text-slate-300 mb-1">Contraseña Maestra</label>
              <input type="password" id="dev-log-pass" value="admin123" required class="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono focus:border-amber-500 focus:outline-none">
            </div>

            <div id="dev-quick-log-error" class="hidden p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl"></div>

            <button type="submit" class="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 text-sm">
              <i class="fas fa-key"></i>
              <span>INGRESAR COMO DEVELOPER</span>
            </button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-dev-modal-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    document.getElementById('dev-quick-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('dev-log-email').value;
      const pass = document.getElementById('dev-log-pass').value;
      const errBox = document.getElementById('dev-quick-log-error');

      try {
        await storage.loginDeveloper(email, pass);
        this.showToast('¡Consola SuperAdmin Developer Conectada!', 'success');
        modalContainer.innerHTML = '';
        this.renderHeader();
        this.navigateTo('developer-dashboard');
      } catch (err) {
        if (errBox) {
          errBox.classList.remove('hidden');
          errBox.textContent = err.message || 'Credenciales incorrectas.';
        } else {
          this.showToast(err.message || 'Credenciales incorrectas.', 'error');
        }
      }
    });
  }

  // Métodos de conveniencia
  renderBusinessAuthModal() {
    this.renderAuthModal({ mode: 'login', role: 'business' });
  }

  renderClientAuthModal() {
    this.renderAuthModal({ mode: 'login', role: 'client' });
  }

  renderNewBusinessModal() {
    this.renderAuthModal({ mode: 'register', role: 'business' });
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
                <label class="block font-bold text-slate-700 mb-1">Precio (₡ CRC) *</label>
                <input type="number" id="srv-price" required min="0" step="500" placeholder="Ej. 15000" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
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

    document.getElementById('new-service-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('srv-name').value;
      const price = document.getElementById('srv-price').value;
      const duration = document.getElementById('srv-duration').value;
      const description = document.getElementById('srv-desc').value;

      await storage.addService(businessId, { name, price, duration, description });
      this.showToast('Servicio agregado al catálogo.', 'success');
      modalContainer.innerHTML = '';
      this.renderCurrentView();
    });
  }

  // --- MODAL PARA EDITAR SERVICIO ---
  renderEditServiceModal(businessId, service) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-bold text-slate-900">Editar Servicio</h3>
            <button id="close-edit-srv-btn" class="text-slate-400 hover:text-slate-600">
              <i class="fas fa-times text-lg"></i>
            </button>
          </div>

          <form id="edit-service-form" class="space-y-4 text-xs sm:text-sm">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Nombre del Servicio *</label>
              <input type="text" id="edit-srv-name" value="${service.name}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Precio (₡ CRC) *</label>
                <input type="number" id="edit-srv-price" value="${service.price}" required min="0" step="500" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Duración (min) *</label>
                <select id="edit-srv-duration" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                  <option value="15" ${service.duration === 15 ? 'selected' : ''}>15 min</option>
                  <option value="30" ${service.duration === 30 ? 'selected' : ''}>30 min</option>
                  <option value="45" ${service.duration === 45 ? 'selected' : ''}>45 min</option>
                  <option value="60" ${service.duration === 60 ? 'selected' : ''}>60 min (1 hr)</option>
                  <option value="90" ${service.duration === 90 ? 'selected' : ''}>90 min (1.5 hrs)</option>
                  <option value="120" ${service.duration === 120 ? 'selected' : ''}>120 min (2 hrs)</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Descripción</label>
              <textarea id="edit-srv-desc" rows="2" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl">${service.description || ''}</textarea>
            </div>

            <button type="submit" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all">
              Guardar Cambios
            </button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-edit-srv-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    document.getElementById('edit-service-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('edit-srv-name').value;
      const price = document.getElementById('edit-srv-price').value;
      const duration = document.getElementById('edit-srv-duration').value;
      const description = document.getElementById('edit-srv-desc').value;

      await storage.updateService(businessId, service.id, { name, price, duration, description });
      this.showToast('Servicio actualizado con éxito.', 'success');
      modalContainer.innerHTML = '';
      this.renderCurrentView();
    });
  }

  // --- MODAL PARA REGISTRAR NUEVO NEGOCIO (CON CONTRASEÑA) ---
  renderNewBusinessModal() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 p-6 sm:p-8 my-8 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div>
              <span class="text-xs font-bold text-emerald-600 uppercase">Onboarding de Comercios 🇨🇷</span>
              <h3 class="text-xl font-extrabold text-slate-900">Registrar Nuevo Establecimiento</h3>
            </div>
            <button id="close-biz-modal-btn" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <form id="new-biz-form" class="space-y-4 text-xs sm:text-sm">
            <!-- Cuenta de Usuario / Credenciales -->
            <div class="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-3">
              <span class="font-bold text-indigo-900 block text-xs uppercase tracking-wider">
                <i class="fas fa-lock mr-1"></i> Credenciales de Acceso para el Dueño
              </span>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Nombre del Administrador *</label>
                  <input type="text" id="reg-owner-name" required placeholder="Ej. Carlos Rodríguez" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium">
                </div>
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Correo para Iniciar Sesión *</label>
                  <input type="email" id="reg-biz-email" required placeholder="admin@comercio.cr" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium">
                </div>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Crea una Contraseña de Acceso *</label>
                <input type="password" id="reg-biz-password" required placeholder="Mínimo 6 caracteres" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium">
              </div>
            </div>

            <!-- Datos Comerciales -->
            <div>
              <label class="block font-bold text-slate-700 mb-1">Nombre Comercial del Negocio *</label>
              <input type="text" id="new-biz-name" required placeholder="Ej. Barbería Costa Rica, Clínica Dental..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Categoría *</label>
                <select id="new-biz-cat" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="belleza">Belleza y Barbería</option>
                  <option value="salud">Salud y Bienestar</option>
                  <option value="spa">Spa y Masajes</option>
                  <option value="fitness">Fitness y Deporte</option>
                  <option value="autos">Talleres y Autos</option>
                  <option value="fotografia">Fotografía y Eventos</option>
                </select>
              </div>

              <div>
                <label class="block font-bold text-slate-700 mb-1">Provincia / Cantón *</label>
                <input type="text" id="new-biz-city" required placeholder="Ej. San José, Escazú / Heredia..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 mb-1">Teléfono / WhatsApp (+506) *</label>
                <input type="tel" id="new-biz-phone" required placeholder="+506 8888 7777" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>
              <div>
                <label class="block font-bold text-slate-700 mb-1">Dirección Exacta</label>
                <input type="text" id="new-biz-address" placeholder="100m Oeste del Parque..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 mb-1">Descripción</label>
              <textarea id="new-biz-desc" rows="2" placeholder="Describe brevemente tus especialidades..." class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"></textarea>
            </div>

            <!-- Fotos con Guía de Medidas -->
            <div class="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl space-y-3">
              <span class="font-bold text-blue-900 block text-xs uppercase tracking-wider">
                <i class="fas fa-camera mr-1"></i> Fotos del Comercio (Guía de Medidas)
              </span>

              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs font-bold text-slate-700">Logo / Foto de Perfil</label>
                  <span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Medida: 800 x 800 px (1:1)</span>
                </div>
                <input type="text" id="new-biz-image" placeholder="URL de imagen cuadrada" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
              </div>

              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs font-bold text-slate-700">Banner / Foto de Portada</label>
                  <span class="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Medida: 1200 x 450 px (16:6)</span>
                </div>
                <input type="text" id="new-biz-cover" placeholder="URL del banner panorámico" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
              </div>
            </div>

            <!-- Primer Servicio -->
            <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <span class="font-bold text-slate-800 block text-xs uppercase tracking-wider">
                <i class="fas fa-tag mr-1 text-emerald-600"></i> Primer Servicio
              </span>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div class="sm:col-span-2">
                  <input type="text" id="first-srv-name" required placeholder="Nombre del servicio (Ej. Corte Clásico)" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs">
                </div>
                <div>
                  <input type="number" id="first-srv-price" required min="0" step="500" placeholder="Precio ₡ CRC" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold">
                </div>
              </div>
            </div>

            <button type="submit" class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/25 transition-all text-sm flex items-center justify-center gap-2">
              <i class="fas fa-check-circle"></i>
              <span>Crear Cuenta y Registrar Negocio</span>
            </button>
          </form>
        </div>
      </div>
    `;

    document.getElementById('close-biz-modal-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    document.getElementById('new-biz-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ownerName = document.getElementById('reg-owner-name').value;
      const email = document.getElementById('reg-biz-email').value;
      const password = document.getElementById('reg-biz-password').value;
      const name = document.getElementById('new-biz-name').value;
      const category = document.getElementById('new-biz-cat').value;
      const city = document.getElementById('new-biz-city').value;
      const phone = document.getElementById('new-biz-phone').value;
      const address = document.getElementById('new-biz-address').value;
      const description = document.getElementById('new-biz-desc').value;
      const image = document.getElementById('new-biz-image').value;
      const coverImage = document.getElementById('new-biz-cover').value;
      const firstSrvName = document.getElementById('first-srv-name').value;
      const firstSrvPrice = document.getElementById('first-srv-price').value;

      const catLabels = {
        belleza: 'Belleza y Barbería',
        salud: 'Salud y Bienestar',
        spa: 'Spa y Masajes',
        fitness: 'Fitness y Deporte',
        autos: 'Talleres y Autos',
        fotografia: 'Fotografía y Eventos'
      };

      try {
        await storage.registerBusinessWithUser(ownerName, email, password, {
          name,
          category,
          categoryLabel: catLabels[category] || 'Servicios',
          city,
          phone,
          email,
          address,
          description,
          image: image || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
          coverImage: coverImage || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
          isDemo: false,
          features: ['Sinpe Móvil', 'Atención Personalizada'],
          services: [
            { name: firstSrvName, duration: 30, price: parseFloat(firstSrvPrice) || 10000, description: 'Servicio principal.' }
          ]
        });

        this.showToast('¡Negocio y cuenta creados exitosamente!', 'success');
        modalContainer.innerHTML = '';
        this.renderHeader();
        this.navigateTo('owner-dashboard');
      } catch (err) {
        this.showToast(err.message || 'Error al registrar.', 'error');
      }
    });
  }

  // --- EVENTOS GLOBALES ---
  setupGlobalEvents() {
    window.addEventListener('keydown', (e) => {
      // Escape para cerrar cualquier modal
      if (e.key === 'Escape') {
        this.closeBookingModal();
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) modalContainer.innerHTML = '';
      }

      // Atajo Secreto de Developer: Ctrl + Shift + D (o Cmd + Shift + D en Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault();
        this.renderDeveloperQuickLoginModal();
      }
    });
  }
}

function startApp() {
  const app = new App();
  app.init();
  window.__turnoYaApp = app;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
