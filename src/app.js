// Controlador principal de la aplicación (Reservas CR - Directorio & Reservas)
import storage from './services/storage.js';

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

  formatDateFullSpanish(dateStr) {
    if (!dateStr) return '';
    const clean = String(dateStr).trim();
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts.map(Number);
      const date = new Date(y, m - 1, d);
      const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      return `${days[date.getDay()]}, ${d} de ${months[m - 1]} de ${y}`;
    }
    return clean;
  }

  normalizeText(str) {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  init() {
    // 1. Escuchar botones Atrás y Adelante del navegador
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.view) {
        this.navigateTo(e.state.view, e.state.params || {}, false);
      } else {
        const route = this.parseHash(window.location.hash);
        this.navigateTo(route.view, route.params || {}, false);
      }
    });

    // 2. Escuchar cambios directos en el Hash
    window.addEventListener('hashchange', () => {
      const route = this.parseHash(window.location.hash);
      this.navigateTo(route.view, route.params || {}, false);
    });

    // 3. Obtener ruta inicial según la URL actual
    const initialRoute = this.parseHash(window.location.hash);
    this.currentView = initialRoute.view;
    this.currentRouteParams = initialRoute.params || {};
    if (initialRoute.params.businessId) {
      this.selectedBusinessId = initialRoute.params.businessId;
    }
    if (initialRoute.params.appointmentId) {
      this.selectedAppointmentId = initialRoute.params.appointmentId;
    }

    const initialHash = this.getHashForView(this.currentView, initialRoute.params);
    if (window.history && window.history.replaceState) {
      window.history.replaceState({ view: this.currentView, params: initialRoute.params }, '', initialHash);
    }

    this.renderHeader();
    this.renderMobileBottomNav();
    this.renderCurrentView();
    this.setupGlobalEvents();
  }

  // --- RUTAS Y HASH DE NAVEGACIÓN ---
  getHashForView(view, params = {}) {
    switch (view) {
      case 'business-detail': {
        const bizId = params.businessId || this.selectedBusinessId;
        return bizId ? `#/negocio/${encodeURIComponent(bizId)}` : '#/';
      }
      case 'review-booking': {
        const aptId = params.appointmentId || this.selectedAppointmentId;
        const query = params.rating ? `?rating=${params.rating}` : '';
        return aptId ? `#/calificar/${encodeURIComponent(aptId)}${query}` : '#/';
      }
      case 'my-client-bookings':
        return '#/mis-citas';
      case 'owner-dashboard':
        return '#/panel-negocio';
      case 'developer-dashboard':
        return '#/developer';
      case 'directory':
      default:
        return '#/';
    }
  }

  parseHash(hash = window.location.hash) {
    const cleanHash = (hash || '').trim();
    const searchParams = new URLSearchParams(window.location.search);

    // 1. Revisar si viene en query params (?calificar=apt-xxx o ?aptId=apt-xxx)
    if (searchParams.has('calificar') || searchParams.has('aptId') || searchParams.has('appointmentId')) {
      const aptId = searchParams.get('calificar') || searchParams.get('aptId') || searchParams.get('appointmentId');
      const rating = searchParams.get('rating');
      return {
        view: 'review-booking',
        params: {
          appointmentId: decodeURIComponent(aptId),
          rating: rating ? parseInt(rating, 10) : null
        }
      };
    }

    // 2. Ruta raíz vacía
    if (!cleanHash || cleanHash === '#' || cleanHash === '#/' || cleanHash === '#!/') {
      return { view: 'directory', params: {} };
    }

    // 3. Revisar hash #/calificar/apt-xxx?rating=5 o #calificar/apt-xxx
    const reviewMatch = cleanHash.match(/^#\/?(calificar|review|valorar)\/([^/?#]+)/i);
    if (reviewMatch) {
      let ratingParam = null;
      if (cleanHash.includes('?')) {
        const hashQuery = cleanHash.split('?')[1];
        const params = new URLSearchParams(hashQuery);
        ratingParam = params.get('rating');
      } else if (searchParams.has('rating')) {
        ratingParam = searchParams.get('rating');
      }
      return {
        view: 'review-booking',
        params: {
          appointmentId: decodeURIComponent(reviewMatch[2]),
          rating: ratingParam ? parseInt(ratingParam, 10) : null
        }
      };
    }

    // 4. Revisar hash #/calificar?id=apt-xxx&rating=5
    if (/^#\/?(calificar|review|valorar)(\?|$)/i.test(cleanHash)) {
      const hashQuery = cleanHash.includes('?') ? cleanHash.split('?')[1] : '';
      const params = new URLSearchParams(hashQuery);
      const aptId = params.get('id') || params.get('appointmentId') || params.get('aptId') || searchParams.get('id') || searchParams.get('appointmentId');
      const ratingParam = params.get('rating') || searchParams.get('rating');
      if (aptId) {
        return {
          view: 'review-booking',
          params: {
            appointmentId: decodeURIComponent(aptId),
            rating: ratingParam ? parseInt(ratingParam, 10) : null
          }
        };
      }
    }

    // 5. Negocio
    const bizMatch = cleanHash.match(/^#\/?negocio\/([^/?#]+)/i);
    if (bizMatch) {
      return { view: 'business-detail', params: { businessId: decodeURIComponent(bizMatch[1]) } };
    }

    // 6. Mis citas
    if (/^#\/?(mis-citas|mis-reservas|cliente)/i.test(cleanHash)) {
      return { view: 'my-client-bookings', params: {} };
    }

    // 7. Panel negocio
    if (/^#\/?(panel-negocio|dashboard|owner)/i.test(cleanHash)) {
      return { view: 'owner-dashboard', params: {} };
    }

    // 8. Developer
    if (/^#\/?(developer|developer-dashboard|admin)/i.test(cleanHash)) {
      return { view: 'developer-dashboard', params: {} };
    }

    return { view: 'directory', params: {} };
  }

  // --- NAVEGACIÓN ---
  navigateTo(view, params = {}, pushHistory = true) {
    this.currentView = view;
    this.currentRouteParams = params || {};
    if (params.businessId) {
      this.selectedBusinessId = params.businessId;
    }
    if (params.appointmentId) {
      this.selectedAppointmentId = params.appointmentId;
    }

    const targetHash = this.getHashForView(view, params);

    if (pushHistory && window.history) {
      if (window.location.hash !== targetHash && window.history.pushState) {
        window.history.pushState({ view, params }, '', targetHash);
      } else if (window.history.replaceState) {
        window.history.replaceState({ view, params }, '', targetHash);
      }
    }

    this.renderHeader();
    this.renderMobileBottomNav();
    this.renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.navigateTo('directory');
    }
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
  renderHeader() {
    const headerContainer = document.getElementById('navbar-container');
    if (!headerContainer) return;

    const devUser = storage.getDeveloperUser();
    const bizUser = storage.getBusinessUser();
    const clientUser = storage.getClientUser();
    const activeBiz = bizUser ? storage.getBusinessById(bizUser.businessId) : null;

    headerContainer.innerHTML = `
      <header class="sticky top-0 z-40 glass-header border-b border-slate-200/80 shadow-xs">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
          <!-- Logo (con acceso secreto 3 clics para Developer) -->
          <div class="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none group app-touch-btn" id="nav-logo-btn" title="Reservas CR (Triple clic: Acceso Developer)">
            <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl overflow-hidden shadow-xs border border-slate-200/90 bg-white flex items-center justify-center group-hover:scale-105 transition-transform duration-300 flex-shrink-0">
              <img src="./src/assets/reservas_cr_clean_badge_1.jpg" alt="Reservas CR Logo" class="w-full h-full object-cover">
            </div>
            <div>
              <span class="font-black text-lg sm:text-xl tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent">Reservas <span class="text-blue-600">CR</span></span>
              <span class="text-[11px] sm:text-xs block text-slate-500 font-medium hidden sm:block">Directorio & Citas en Costa Rica 🇨🇷</span>
            </div>
          </div>

          <!-- MÓVIL (< md): Controles Compactos Superiores -->
          <div class="flex md:hidden items-center gap-1.5">
            ${devUser ? `
              <button id="mobile-top-dev-badge" class="px-2.5 py-1 rounded-lg bg-slate-900 text-amber-400 text-[11px] font-black border border-slate-700 flex items-center gap-1 app-touch-btn" title="Panel Developer">
                <i class="fas fa-shield-alt text-[10px]"></i>
                <span>DEV</span>
              </button>
            ` : ''}

            ${clientUser && !devUser ? `
              <button id="mobile-top-profile-badge" class="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200/60 flex items-center gap-1.5 app-touch-btn">
                <i class="fas fa-user-circle text-xs text-blue-600"></i>
                <span class="max-w-[80px] truncate">${clientUser.name ? clientUser.name.split(' ')[0] : 'Perfil'}</span>
              </button>
            ` : ''}

            ${bizUser && !devUser ? `
              <button id="mobile-top-biz-badge" class="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-200/60 flex items-center gap-1.5 app-touch-btn">
                <i class="fas fa-store text-xs text-indigo-600"></i>
                <span class="max-w-[80px] truncate">${activeBiz ? activeBiz.name : 'Negocio'}</span>
              </button>
            ` : ''}

            ${!clientUser && !bizUser && !devUser ? `
              <button id="mobile-top-login-btn" class="px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 flex items-center gap-1 app-touch-btn">
                <i class="fas fa-sign-in-alt text-xs"></i>
                <span>Entrar</span>
              </button>
            ` : ''}
          </div>

          <!-- ESCRITORIO PC (>= md): Navigation & Auth Controls Completos -->
          <div class="hidden md:flex items-center gap-2 sm:gap-3">
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

    // Acciones móviles superiores
    document.getElementById('mobile-top-dev-badge')?.addEventListener('click', () => this.navigateTo('developer-dashboard'));
    document.getElementById('mobile-top-profile-badge')?.addEventListener('click', () => this.navigateTo('my-client-bookings'));
    document.getElementById('mobile-top-biz-badge')?.addEventListener('click', () => this.navigateTo('owner-dashboard'));
    document.getElementById('mobile-top-login-btn')?.addEventListener('click', () => this.renderAuthModal({ mode: 'login', role: 'client' }));

    // Developer logueado
    document.getElementById('nav-dev-dashboard-btn')?.addEventListener('click', () => this.navigateTo('developer-dashboard'));
    document.getElementById('nav-dev-logout-btn')?.addEventListener('click', () => {
      storage.logoutDeveloper();
      this.showToast('Sesión de Developer cerrada.', 'info');
      this.renderHeader();
      this.renderMobileBottomNav();
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
      this.renderMobileBottomNav();
      if (this.currentView === 'my-client-bookings') this.navigateTo('directory');
    });

    // Negocio logueado
    document.getElementById('nav-biz-dashboard-btn')?.addEventListener('click', () => this.navigateTo('owner-dashboard'));
    document.getElementById('nav-biz-logout-btn')?.addEventListener('click', () => {
      storage.logoutBusiness();
      this.showToast('Sesión de negocio cerrada.', 'info');
      this.renderHeader();
      this.renderMobileBottomNav();
      if (this.currentView === 'owner-dashboard') this.navigateTo('directory');
    });
  }

  // --- BARRA DE NAVEGACIÓN MÓVIL INFERIOR (ESTILO APP NATIVA - EXCLUSIVO CELULARES Y TABLETS) ---
  renderMobileBottomNav() {
    const navContainer = document.getElementById('mobile-bottom-nav-container');
    if (!navContainer) return;

    const devUser = storage.getDeveloperUser();
    const bizUser = storage.getBusinessUser();
    const clientUser = storage.getClientUser();

    const isDirectory = this.currentView === 'directory' || this.currentView === 'business-detail';
    const isBookings = this.currentView === 'my-client-bookings';
    const isOwner = this.currentView === 'owner-dashboard';
    const isDev = this.currentView === 'developer-dashboard';

    navContainer.innerHTML = `
      <div class="fixed bottom-0 inset-x-0 z-40 bottom-nav-blur border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-2 py-1 pb-safe md:hidden">
        <div class="max-w-md mx-auto grid grid-cols-4 gap-1 text-center">
          
          <!-- 1. Explorar -->
          <button id="mobile-nav-explore-btn" class="app-touch-btn flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${isDirectory ? 'text-blue-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
            <div class="w-8 h-8 flex items-center justify-center rounded-xl ${isDirectory ? 'bg-blue-50 text-blue-600' : ''}">
              <i class="fas fa-compass text-base ${isDirectory ? 'scale-110' : ''}"></i>
            </div>
            <span class="text-[10px] mt-0.5 tracking-tight">Explorar</span>
          </button>

          <!-- 2. Mis Citas -->
          <button id="mobile-nav-bookings-btn" class="app-touch-btn flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${isBookings ? 'text-blue-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
            <div class="w-8 h-8 flex items-center justify-center rounded-xl ${isBookings ? 'bg-blue-50 text-blue-600' : ''}">
              <i class="fas fa-calendar-alt text-base ${isBookings ? 'scale-110' : ''}"></i>
            </div>
            <span class="text-[10px] mt-0.5 tracking-tight">Mis Citas</span>
          </button>

          <!-- 3. Mi Negocio -->
          <button id="mobile-nav-biz-btn" class="app-touch-btn flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${isOwner ? 'text-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
            <div class="w-8 h-8 flex items-center justify-center rounded-xl ${isOwner ? 'bg-indigo-50 text-indigo-600' : ''}">
              <i class="fas fa-store text-base ${isOwner ? 'scale-110' : ''}"></i>
            </div>
            <span class="text-[10px] mt-0.5 tracking-tight">${bizUser ? 'Mi Panel' : 'Soy Negocio'}</span>
          </button>

          <!-- 4. Cuenta / Dev -->
          ${devUser ? `
            <button id="mobile-nav-dev-btn" class="app-touch-btn flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${isDev ? 'text-amber-500 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
              <div class="w-8 h-8 flex items-center justify-center rounded-xl ${isDev ? 'bg-amber-100 text-amber-600' : ''}">
                <i class="fas fa-shield-alt text-base ${isDev ? 'scale-110' : ''}"></i>
              </div>
              <span class="text-[10px] mt-0.5 tracking-tight">Developer</span>
            </button>
          ` : `
            <button id="mobile-nav-account-btn" class="app-touch-btn flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl transition-all cursor-pointer ${clientUser || bizUser ? 'text-blue-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
              <div class="w-8 h-8 flex items-center justify-center rounded-xl ${clientUser || bizUser ? 'bg-blue-50 text-blue-600' : ''}">
                <i class="fas fa-user-circle text-base"></i>
              </div>
              <span class="text-[10px] mt-0.5 tracking-tight">${clientUser ? (clientUser.name ? clientUser.name.split(' ')[0] : 'Perfil') : (bizUser ? 'Comercio' : 'Cuenta')}</span>
            </button>
          `}

        </div>
      </div>
    `;

    // Eventos de la barra inferior móvil
    document.getElementById('mobile-nav-explore-btn')?.addEventListener('click', () => {
      this.navigateTo('directory');
    });

    document.getElementById('mobile-nav-bookings-btn')?.addEventListener('click', () => {
      this.navigateTo('my-client-bookings');
    });

    document.getElementById('mobile-nav-biz-btn')?.addEventListener('click', () => {
      if (bizUser) {
        this.navigateTo('owner-dashboard');
      } else {
        this.renderAuthModal({ mode: 'login', role: 'business' });
      }
    });

    document.getElementById('mobile-nav-dev-btn')?.addEventListener('click', () => {
      this.navigateTo('developer-dashboard');
    });

    document.getElementById('mobile-nav-account-btn')?.addEventListener('click', () => {
      if (clientUser) {
        this.navigateTo('my-client-bookings');
      } else if (bizUser) {
        this.navigateTo('owner-dashboard');
      } else {
        this.renderAuthModal({ mode: 'login', role: 'client' });
      }
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
      case 'review-booking':
        this.renderReviewBookingView(main, this.currentRouteParams?.appointmentId || this.selectedAppointmentId, this.currentRouteParams?.rating);
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
  filterBusinessesList(allBusinesses, query, categoryId) {
    let list = allBusinesses.filter(b => !b.isHidden && !b.isBlocked);
    
    if (categoryId && categoryId !== 'all') {
      list = list.filter(b => b.category === categoryId);
    }
    
    if (query && query.trim() !== '') {
      const cleanQ = this.normalizeText(query);
      const words = cleanQ.split(/\s+/).filter(w => w.length > 0);

      list = list.filter(biz => {
        const searchableFields = [
          biz.name,
          biz.categoryLabel,
          biz.category,
          biz.description,
          biz.city,
          biz.address,
          ...(biz.features || []),
          ...(biz.services ? biz.services.map(s => `${s.name} ${s.description || ''}`) : [])
        ];

        const fullHaystack = this.normalizeText(searchableFields.filter(Boolean).join(' '));
        return words.every(word => fullHaystack.includes(word));
      });
    }

    // Ordenamiento por Plan de Suscripción (Posición Preferencial para Plan Ilimitado y Pro)
    return list.sort((a, b) => {
      const planScore = { unlimited: 3, pro: 2, basic: 1 };
      const scoreA = planScore[a.plan] || 1;
      const scoreB = planScore[b.plan] || 1;
      if (scoreA !== scoreB) return scoreB - scoreA;
      // Desempate por rating o comercios reales
      if (Boolean(a.isDemo) !== Boolean(b.isDemo)) return a.isDemo ? 1 : -1;
      return (b.rating || 5) - (a.rating || 5);
    });
  }

  renderBusinessCard(biz) {
    const isUnlimited = biz.plan === 'unlimited';
    const isPro = biz.plan === 'pro';

    return `
      <div class="bg-white rounded-3xl border ${isUnlimited ? 'border-purple-300 ring-2 ring-purple-500/10 shadow-md' : isPro ? 'border-amber-300 shadow-sm' : 'border-slate-200 shadow-xs'} overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col group hover:-translate-y-1 relative">
        <!-- Image Header -->
        <div class="relative h-52 overflow-hidden bg-slate-100">
          <img src="${biz.image || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80'}" alt="${this.escapeHtml(biz.name)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy">
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30"></div>
          
          <!-- Badges de Plan y Tipo de Comercio -->
          <div class="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
            ${isUnlimited ? `
              <span class="bg-gradient-to-r from-purple-700 to-indigo-700 text-white backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-black flex items-center gap-1 shadow-lg border border-purple-400/40 animate-pulse">
                <i class="fas fa-crown text-amber-300"></i> Top Destacado
              </span>
            ` : isPro ? `
              <span class="bg-amber-500 text-slate-950 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-black flex items-center gap-1 shadow-md border border-amber-300">
                <i class="fas fa-check-circle text-slate-950"></i> Negocio Verificado
              </span>
            ` : biz.isDemo ? `
              <span class="bg-purple-700/90 text-white backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 shadow-md border border-purple-400/40">
                <i class="fas fa-flask text-purple-200"></i> Comercio de Muestra
              </span>
            ` : `
              <span class="bg-emerald-600/90 text-white backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 shadow-md">
                <i class="fas fa-store text-emerald-200"></i> Negocio Registrado
              </span>
            `}
            <span class="bg-white/95 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[11px] font-bold text-slate-800 shadow-sm">
              ${this.escapeHtml(biz.categoryLabel || biz.category)}
            </span>
          </div>

          <!-- Rating -->
          <span class="absolute top-3 right-3 bg-amber-400 text-slate-900 px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1 shadow-sm">
            <i class="fas fa-star text-xs"></i> ${biz.rating || 5.0} <span class="text-slate-700 font-normal">(${biz.reviewsCount || 0})</span>
          </span>

          <div class="absolute bottom-3 left-3 right-3 text-white">
            <span class="text-xs font-semibold text-slate-200 flex items-center gap-1">
              <i class="fas fa-map-marker-alt text-rose-400"></i> ${this.escapeHtml(biz.city || 'Costa Rica')}
            </span>
          </div>
        </div>

        <!-- Content Body -->
        <div class="p-5 flex-1 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between gap-2">
              <h3 class="font-bold text-lg text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                ${this.escapeHtml(biz.name)}
              </h3>
              ${isUnlimited ? `<span class="text-xs font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md flex-shrink-0">Preferencial</span>` : ''}
            </div>
            <p class="text-xs text-slate-500 mt-1 line-clamp-2">
              ${this.escapeHtml(biz.description || '')}
            </p>

            <!-- Key Services Preview -->
            ${biz.services && biz.services.length > 0 ? `
              <div class="mt-3 space-y-1.5">
                ${biz.services.slice(0, 2).map(srv => `
                  <div class="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                    <span class="text-slate-600 font-medium truncate max-w-[170px]">${this.escapeHtml(srv.name)}</span>
                    <span class="font-extrabold text-blue-600 flex-shrink-0">${this.formatColones(srv.price)}</span>
                  </div>
                `).join('')}
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
              class="view-biz-btn w-full py-2.5 px-4 ${isUnlimited ? 'bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800' : 'bg-slate-900 hover:bg-blue-600'} text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
              data-business-id="${biz.id}"
            >
              <span>Ver Servicios & Reservar</span>
              <i class="fas fa-arrow-right text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  renderDirectoryGridContent(businesses) {
    if (businesses.length === 0) {
      return `
        <div class="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 max-w-md mx-auto shadow-xs">
          <div class="w-14 h-14 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">
            <i class="fas fa-search"></i>
          </div>
          <h3 class="text-base font-bold text-slate-800">No encontramos comercios que coincidan</h3>
          <p class="text-xs text-slate-500 mt-1 leading-relaxed">Prueba con otra palabra clave, nombre de servicio o selecciona otra categoría.</p>
          <button id="reset-filter-btn" class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer">
            <i class="fas fa-undo mr-1"></i> Ver todos los negocios
          </button>
        </div>
      `;
    }

    return `
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${businesses.map(biz => this.renderBusinessCard(biz)).join('')}
      </div>
    `;
  }

  renderDirectoryView(container) {
    const categories = storage.getCategories();
    const allBusinesses = storage.getBusinesses();
    const filteredBusinesses = this.filterBusinessesList(allBusinesses, this.searchQuery, this.selectedCategory);

    container.innerHTML = `
      <div class="animate-fade-in pb-20">
        <!-- 1. Banner Superior Destacado para Negocios (+20% Tamaño y Espaciado Óptimo) -->
        <section class="max-w-6xl mx-auto px-4 sm:px-6 pt-3">
          <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white py-5 px-5 sm:py-6 sm:px-8 shadow-xl border border-indigo-900/40">
            <!-- Efectos de Fondo sutiles -->
            <div class="absolute -top-16 -right-16 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
            <div class="absolute -bottom-16 -left-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
            
            <div class="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <!-- Columna Texto e Incentivos -->
              <div class="lg:col-span-7 space-y-2.5 text-left">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider border border-indigo-500/30">
                    <i class="fas fa-rocket text-amber-400 text-[10px]"></i> Para Comercios & Profesionales
                  </span>
                </div>
                
                <h2 class="text-lg sm:text-xl md:text-2xl font-black tracking-tight leading-tight">
                  Dile a tus clientes que <span class="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400">ya tienen dónde reservar 24/7</span>
                </h2>
                
                <p class="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                  Evita llamadas y mensajes perdidos. Ten tu página propia con catálogo, precios y citas listas para compartir por WhatsApp y redes.
                </p>

                <!-- Beneficios Rápidos (Chips Horizontales) -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div class="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-slate-200">
                    <i class="fab fa-whatsapp text-emerald-400 text-sm flex-shrink-0"></i>
                    <span class="truncate">WhatsApp Auto</span>
                  </div>

                  <div class="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-slate-200">
                    <i class="fas fa-link text-blue-400 text-sm flex-shrink-0"></i>
                    <span class="truncate">Tu Enlace Web</span>
                  </div>

                  <div class="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-slate-200">
                    <i class="fas fa-clock text-amber-400 text-sm flex-shrink-0"></i>
                    <span class="truncate">Turnos 24/7</span>
                  </div>

                  <div class="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-slate-200">
                    <i class="fas fa-chart-line text-purple-400 text-sm flex-shrink-0"></i>
                    <span class="truncate">Panel de Control</span>
                  </div>
                </div>

                <!-- Botones de Acción -->
                <div class="flex flex-wrap items-center gap-2.5 pt-1.5">
                  <button id="cta-register-biz-btn" class="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-black shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 cursor-pointer app-touch-btn">
                    <i class="fas fa-plus-circle text-xs"></i>
                    <span>Registrar Mi Negocio</span>
                  </button>

                  <button id="cta-view-plans-btn" class="px-3.5 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 hover:text-amber-200 text-xs sm:text-sm font-bold border border-amber-400/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer app-touch-btn">
                    <i class="fas fa-tags text-amber-400 text-xs"></i>
                    <span>Ver Planes ($8, $15, $25)</span>
                    <span>Ver Planes</span>
                  </button>
                  
                  <button id="cta-login-biz-btn" class="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 hover:text-white text-xs sm:text-sm font-medium border border-white/10 flex items-center justify-center gap-1.5 transition-all cursor-pointer app-touch-btn">
                    <i class="fas fa-store text-xs"></i>
                    <span>Ya tengo cuenta</span>
                  </button>
                </div>
              </div>

              <!-- Columna Ilustrativa / Preview Card -->
              <div class="lg:col-span-5 flex justify-center">
                <div class="w-full max-w-[300px] bg-slate-900/90 rounded-2xl p-3.5 border border-indigo-500/30 shadow-md backdrop-blur-md space-y-2.5">
                  <div class="flex items-center justify-between pb-2 border-b border-slate-800">
                    <div class="flex items-center gap-2">
                      <div class="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                        <i class="fas fa-store"></i>
                      </div>
                      <div>
                        <h4 class="text-xs font-black text-white leading-none">Tu Negocio Aquí</h4>
                        <p class="text-[10px] text-slate-400">reservas.cr/#/negocio/tu-local</p>
                      </div>
                    </div>
                    <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">Activo 24/7</span>
                  </div>

                  <div class="space-y-2 text-xs">
                    <div class="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <i class="fas fa-calendar-check text-blue-400 text-xs"></i>
                        <span class="text-slate-200 font-medium">Nueva Reserva</span>
                      </div>
                      <span class="text-emerald-400 font-bold">₡15,000</span>
                    </div>
                    <div class="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <i class="fab fa-whatsapp text-emerald-400 text-xs"></i>
                        <span class="text-slate-200 font-medium">WhatsApp Enviado</span>
                      </div>
                      <span class="text-slate-400 text-[10px]">10:30 AM</span>
                    </div>
                  </div>

                  <div class="py-1.5 px-2.5 rounded-xl bg-indigo-950/60 border border-indigo-500/20 text-center flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-300">
                    <i class="fas fa-bolt text-[10px]"></i>
                    <span>Toma menos de 2 minutos</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 2. Hero Section: Exploración y Búsqueda de Citas -->
        <section class="relative bg-gradient-to-b from-blue-50/70 via-white to-slate-50 border-b border-slate-200/70 py-10 px-4 sm:px-6 lg:px-8 mt-4">
          <div class="max-w-4xl mx-auto text-center">
            <span class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/80 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3">
              <i class="fas fa-bolt text-blue-600"></i> Reserva tu turno en línea en Costa Rica
            </span>
            <h1 class="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Encuentra los mejores comercios y <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">agenda tu cita al instante</span>
            </h1>
            <p class="mt-3 text-slate-600 text-sm sm:text-base max-w-2xl mx-auto">
              Barberías, spas, dentistas, talleres mecánicos y más. Escribe cualquier servicio o cantón para filtrar en tiempo real.
            </p>

            <!-- Buscador Inteligente -->
            <div class="mt-6 max-w-2xl mx-auto relative flex items-center shadow-lg rounded-2xl bg-white border border-slate-200 p-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <div class="pl-3.5 text-blue-600">
                <i class="fas fa-search text-base"></i>
              </div>
              <input 
                type="text" 
                id="search-input" 
                value="${this.searchQuery}" 
                placeholder="Busca por comercio, servicio ('corte', 'spa', 'frenos') o cantón..." 
                class="w-full px-3.5 py-2.5 text-slate-800 placeholder-slate-400 bg-transparent text-sm sm:text-base focus:outline-none"
                autocomplete="off"
              />
              <button id="clear-search-btn" class="${this.searchQuery ? '' : 'hidden'} p-2 text-slate-400 hover:text-slate-600 mr-1 transition-all cursor-pointer" title="Limpiar búsqueda">
                <i class="fas fa-times-circle text-base"></i>
              </button>
              <button id="do-search-btn" class="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all shadow-md shadow-blue-500/20 text-xs sm:text-sm flex items-center gap-1.5 cursor-pointer flex-shrink-0">
                <i class="fas fa-search text-xs"></i>
                <span>Buscar</span>
              </button>
            </div>

            <!-- Mini Banner de Acceso / Registro para Negocios en Hero -->
            <div class="mt-5 inline-flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600 bg-white/90 backdrop-blur-md py-1.5 px-3.5 rounded-2xl border border-slate-200 shadow-2xs">
              <span class="font-bold text-slate-800 flex items-center gap-1.5">
                <i class="fas fa-store text-indigo-600"></i> ¿Tienes un negocio o prestas servicios?
              </span>
              <button id="hero-register-biz-btn" class="font-black text-blue-600 hover:text-blue-800 underline decoration-2 underline-offset-2 flex items-center gap-1 transition-colors cursor-pointer">
                ¡Publica tu catálogo y recibe citas aquí! <i class="fas fa-arrow-right text-[10px]"></i>
              </button>
            </div>
          </div>
        </section>

        <!-- 3. Filtro por Categorías -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div class="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar" id="category-pills-container">
            ${categories.map(cat => `
              <button 
                class="category-pill-btn flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all cursor-pointer ${this.selectedCategory === cat.id ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}"
                data-category-id="${cat.id}"
              >
                <i class="fas ${cat.icon} text-xs"></i>
                <span>${cat.name}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <!-- 4. Catálogo de Establecimientos (Contenedor Reactivo) -->
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
            <div>
              <h2 class="text-lg sm:text-xl font-bold text-slate-900" id="catalog-category-title">
                ${this.selectedCategory === 'all' ? 'Todos los Establecimientos' : categories.find(c => c.id === this.selectedCategory)?.name || 'Negocios'}
              </h2>
              <p class="text-xs text-slate-500 mt-0.5" id="catalog-count-text">
                ${this.searchQuery ? `Mostrando ${filteredBusinesses.length} resultados para "<strong>${this.escapeHtml(this.searchQuery)}</strong>"` : `${filteredBusinesses.length} comercios disponibles`}
              </p>
            </div>
          </div>

          <div id="catalog-grid-container">
            ${this.renderDirectoryGridContent(filteredBusinesses)}
          </div>
        </div>
      </div>
    `;

    // Listeners Inteligentes en Tiempo Real
    const searchInput = document.getElementById('search-input');
    const doSearchBtn = document.getElementById('do-search-btn');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    const catalogGridContainer = document.getElementById('catalog-grid-container');
    const catalogCountText = document.getElementById('catalog-count-text');

    const attachCardListeners = () => {
      document.querySelectorAll('.view-biz-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const bId = btn.getAttribute('data-business-id');
          this.navigateTo('business-detail', { businessId: bId });
        });
      });

      document.getElementById('reset-filter-btn')?.addEventListener('click', () => {
        this.searchQuery = '';
        this.selectedCategory = 'all';
        if (searchInput) searchInput.value = '';
        updateLiveSearch();
        this.renderCurrentView();
      });
    };

    const updateLiveSearch = () => {
      const q = searchInput ? searchInput.value : '';
      this.searchQuery = q;
      
      if (clearSearchBtn) {
        clearSearchBtn.classList.toggle('hidden', !q.trim());
      }

      const allBiz = storage.getBusinesses();
      const currentList = this.filterBusinessesList(allBiz, q, this.selectedCategory);

      if (catalogGridContainer) {
        catalogGridContainer.innerHTML = this.renderDirectoryGridContent(currentList);
      }

      if (catalogCountText) {
        catalogCountText.innerHTML = q.trim() 
          ? `Mostrando ${currentList.length} resultados para "<strong>${this.escapeHtml(q.trim())}</strong>"`
          : `${currentList.length} comercios disponibles`;
      }

      attachCardListeners();
    };

    // Filtrado en vivo mientras el usuario escribe
    searchInput?.addEventListener('input', () => {
      updateLiveSearch();
    });

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        updateLiveSearch();
      }
    });

    doSearchBtn?.addEventListener('click', () => {
      updateLiveSearch();
    });

    clearSearchBtn?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      updateLiveSearch();
    });

    // Píldoras de Categoría
    document.querySelectorAll('.category-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedCategory = btn.getAttribute('data-category-id');
        this.renderCurrentView();
      });
    });

    attachCardListeners();

    // Listeners para Registro / Login de Negocios
    document.getElementById('hero-register-biz-btn')?.addEventListener('click', () => this.renderAuthModal({ mode: 'register', role: 'business' }));
    document.getElementById('cta-register-biz-btn')?.addEventListener('click', () => this.renderAuthModal({ mode: 'register', role: 'business' }));
    document.getElementById('cta-view-plans-btn')?.addEventListener('click', () => this.renderPlansModal());
    document.getElementById('cta-login-biz-btn')?.addEventListener('click', () => this.renderAuthModal({ mode: 'login', role: 'business' }));
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

    // Formatear enlaces de Redes Sociales
    const social = biz.socialLinks || biz.social_links || {};
    const formatIg = (val) => {
      if (!val || !val.trim()) return null;
      const c = val.trim();
      return c.startsWith('http') ? c : `https://instagram.com/${c.replace(/^@/, '')}`;
    };
    const formatFb = (val) => {
      if (!val || !val.trim()) return null;
      const c = val.trim();
      return c.startsWith('http') ? c : `https://facebook.com/${c}`;
    };
    const formatTt = (val) => {
      if (!val || !val.trim()) return null;
      const c = val.trim();
      return c.startsWith('http') ? c : `https://tiktok.com/${c.startsWith('@') ? c : `@${c}`}`;
    };
    const formatWeb = (val) => {
      if (!val || !val.trim()) return null;
      const c = val.trim();
      return c.startsWith('http') ? c : `https://${c}`;
    };

    const igUrl = formatIg(social.instagram);
    const fbUrl = formatFb(social.facebook);
    const ttUrl = formatTt(social.tiktok);
    const webUrl = formatWeb(social.website);
    const hasSocial = Boolean(igUrl || fbUrl || ttUrl || webUrl);

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

            <!-- Reseñas y Calificaciones Verificadas -->
            <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div class="flex items-center gap-2">
                    <h2 class="text-xl font-bold text-slate-900">Opiniones de Clientes</h2>
                    <span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black border border-emerald-200 flex items-center gap-1">
                      <i class="fas fa-shield-alt text-[10px]"></i> Verificadas
                    </span>
                  </div>
                  <p class="text-xs text-slate-500 mt-0.5">Calificaciones 100% auténticas de personas que completaron su cita.</p>
                </div>

                <div class="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200/80">
                  <span class="text-3xl font-black text-slate-900">${biz.rating || 5.0}</span>
                  <div>
                    <div class="flex text-amber-400 text-xs">
                      ${Array(5).fill(0).map((_, i) => `<i class="${i < Math.round(biz.rating || 5) ? 'fas' : 'far'} fa-star"></i>`).join('')}
                    </div>
                    <span class="text-[11px] font-bold text-slate-500">${biz.reviewsCount || 0} valoraciones</span>
                  </div>
                </div>
              </div>

              <div id="biz-reviews-container" class="space-y-4">
                <div class="flex items-center justify-center py-6 text-slate-400 gap-2 text-xs">
                  <i class="fas fa-circle-notch fa-spin text-blue-600"></i> Cargando opiniones verificadas...
                </div>
              </div>
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
                <div class="pt-3 border-t border-slate-100">
                  <a href="https://wa.me/${biz.phone.replace(/[^0-9]/g, '')}" target="_blank" rel="noopener noreferrer" class="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs">
                    <i class="fab fa-whatsapp text-sm"></i> Chatear por WhatsApp
                  </a>
                </div>
              ` : ''}

              <!-- Redes Sociales y Enlaces Oficiales -->
              ${hasSocial ? `
                <div class="pt-3 border-t border-slate-100 space-y-2.5">
                  <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Redes Sociales & Web</span>
                  <div class="flex flex-wrap items-center gap-2">
                    ${igUrl ? `
                      <a href="${igUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:opacity-95 transition-opacity" title="Instagram">
                        <i class="fab fa-instagram"></i> Instagram
                      </a>
                    ` : ''}
                    ${fbUrl ? `
                      <a href="${fbUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-xl bg-[#1877F2] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:opacity-95 transition-opacity" title="Facebook">
                        <i class="fab fa-facebook"></i> Facebook
                      </a>
                    ` : ''}
                    ${ttUrl ? `
                      <a href="${ttUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-black transition-colors" title="TikTok">
                        <i class="fab fa-tiktok"></i> TikTok
                      </a>
                    ` : ''}
                    ${webUrl ? `
                      <a href="${webUrl}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs hover:bg-indigo-700 transition-colors" title="Sitio Web">
                        <i class="fas fa-globe"></i> Sitio Web
                      </a>
                    ` : ''}
                  </div>
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

    // Cargar opiniones del negocio de forma asíncrona
    storage.getBusinessReviews(biz.id).then(reviews => {
      const revBox = document.getElementById('biz-reviews-container');
      if (!revBox) return;

      if (reviews && reviews.length > 0) {
        revBox.innerHTML = reviews.map(rev => `
          <div class="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                  ${(rev.clientName || 'C').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div class="flex items-center gap-1.5">
                    <span class="font-bold text-xs text-slate-900">${this.escapeHtml(rev.clientName)}</span>
                    <span class="text-[10px] text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded font-semibold">✓ Verificado</span>
                  </div>
                  <span class="text-[11px] text-blue-600 font-medium">Servicio: ${this.escapeHtml(rev.serviceName || 'Atención')}</span>
                </div>
              </div>
              <div class="text-right">
                <div class="flex text-amber-400 text-xs">
                  ${Array(5).fill(0).map((_, i) => `<i class="${i < rev.rating ? 'fas' : 'far'} fa-star"></i>`).join('')}
                </div>
                <span class="text-[10px] text-slate-400">${this.formatDateDMY(rev.createdAt ? rev.createdAt.split('T')[0] : '')}</span>
              </div>
            </div>
            ${rev.comment ? `
              <p class="text-xs text-slate-700 leading-relaxed italic bg-white p-3 rounded-xl border border-slate-100">
                "${this.escapeHtml(rev.comment)}"
              </p>
            ` : ''}
          </div>
        `).join('');
      } else {
        revBox.innerHTML = `
          <div class="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <i class="far fa-comment-dots text-slate-300 text-3xl mb-2 block"></i>
            <p class="text-xs text-slate-500 font-medium">Aún no hay opiniones escritas para este comercio.</p>
            <p class="text-[11px] text-slate-400 mt-1">Los clientes reciben un correo de valoración automáticamente al finalizar su turno.</p>
          </div>
        `;
      }
    });

    document.getElementById('back-to-directory-btn')?.addEventListener('click', () => this.goBack());

    document.querySelectorAll('.book-service-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sId = btn.getAttribute('data-service-id');
        this.openBookingModal(biz.id, sId);
      });
    });
  }

  // ==========================================
  // VISTA: PANTALLA DE CALIFICACIÓN Y RESEÑA VERIFICADA (#/calificar/:id)
  // ==========================================
  async renderReviewBookingView(container, appointmentId, preselectedRating = null, allowEdit = false) {
    if (!appointmentId) {
      this.navigateTo('directory');
      return;
    }

    container.innerHTML = `
      <div class="max-w-xl mx-auto px-4 py-12 animate-fade-in">
        <div class="flex items-center justify-center py-20 text-slate-400 gap-3">
          <i class="fas fa-circle-notch fa-spin text-2xl text-blue-600"></i>
          <span class="font-medium text-slate-600">Cargando datos de tu cita...</span>
        </div>
      </div>
    `;

    const info = await storage.getReviewInfo(appointmentId);
    if (info.error || !info.appointment) {
      container.innerHTML = `
        <div class="max-w-md mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 text-center shadow-lg animate-fade-in">
          <div class="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            <i class="fas fa-exclamation-circle"></i>
          </div>
          <h2 class="text-xl font-bold text-slate-900 mb-2">No pudimos encontrar la cita</h2>
          <p class="text-xs text-slate-500 mb-6">${info.error || 'El código de la cita no es válido o ha expirado.'}</p>
          <button id="review-go-home-btn" class="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition-all text-xs">
            Ir al Inicio
          </button>
        </div>
      `;
      document.getElementById('review-go-home-btn')?.addEventListener('click', () => this.navigateTo('directory'));
      return;
    }

    const { appointment: apt, alreadyReviewed, review } = info;
    let currentSelectedRating = preselectedRating && preselectedRating >= 1 && preselectedRating <= 5 ? preselectedRating : (review ? review.rating : 5);

    const ratingLabels = {
      1: 'Malo 😞',
      2: 'Regular 😐',
      3: 'Bueno 🙂',
      4: 'Muy Bueno 😊',
      5: '¡Excelente! 🤩'
    };

    if (alreadyReviewed && review && !allowEdit) {
      container.innerHTML = `
        <div class="max-w-lg mx-auto px-4 py-10 animate-fade-in">
          <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl text-center space-y-6">
            <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl shadow-md">
              <i class="fas fa-check"></i>
            </div>
            
            <div>
              <span class="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-extrabold border border-emerald-200 inline-flex items-center gap-1.5">
                <i class="fas fa-shield-alt text-[11px]"></i> Reseña Verificada Publicada
              </span>
              <h1 class="text-2xl font-black text-slate-900 mt-3">¡Ya calificaste esta atención!</h1>
              <p class="text-xs text-slate-500 mt-1">Muchas gracias por apoyar la transparencia y calidad de los negocios locales en Costa Rica.</p>
            </div>

            <!-- Resumen de su calificación -->
            <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-left space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-black text-slate-900 text-sm">${apt.businessName}</h3>
                  <span class="text-xs text-blue-600 font-semibold">${apt.serviceName}</span>
                </div>
                <div class="flex text-amber-400 text-base">
                  ${Array(5).fill(0).map((_, i) => `<i class="${i < review.rating ? 'fas' : 'far'} fa-star"></i>`).join('')}
                </div>
              </div>
              ${review.comment ? `
                <p class="text-xs text-slate-700 italic bg-white p-3 rounded-xl border border-slate-100">
                  "${this.escapeHtml(review.comment)}"
                </p>
              ` : ''}
              <div class="text-[11px] text-slate-400">Fecha de visita: ${this.formatDateDMY(apt.date)}</div>
            </div>

            <div class="flex flex-col sm:flex-row items-center gap-3 justify-center pt-2">
              <button id="edit-review-btn" class="w-full sm:w-auto px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer">
                <i class="fas fa-edit"></i> Modificar mi Calificación
              </button>
              <button id="view-biz-page-btn" class="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20">
                Ver Ficha de ${apt.businessName}
              </button>
              <button id="go-explore-home-btn" class="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all">
                Explorar Más Comercios
              </button>
            </div>
          </div>
        </div>
      `;

      document.getElementById('edit-review-btn')?.addEventListener('click', () => {
        this.renderReviewBookingView(container, appointmentId, review?.rating, true);
      });
      document.getElementById('view-biz-page-btn')?.addEventListener('click', () => {
        this.navigateTo('business-detail', { businessId: apt.businessId });
      });
      document.getElementById('go-explore-home-btn')?.addEventListener('click', () => {
        this.navigateTo('directory');
      });
      return;
    }

    // Formulario de Calificación
    container.innerHTML = `
      <div class="max-w-xl mx-auto px-4 py-8 sm:py-12 animate-fade-in">
        <div class="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xl space-y-6">
          
          <!-- Encabezado de la Cita -->
          <div class="text-center space-y-2 pb-4 border-b border-slate-100">
            <span class="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-extrabold border border-blue-200/80 inline-flex items-center gap-1.5">
              <i class="fas fa-shield-alt text-[11px] text-blue-600"></i> Calificación Verificada por Cita Real
            </span>
            <h1 class="text-2xl sm:text-3xl font-black text-slate-900">¿Cómo estuvo tu atención?</h1>
            <p class="text-xs text-slate-500">Tu opinión ayuda al comercio a mejorar y a otros clientes a elegir el mejor servicio.</p>
          </div>

          <!-- Tarjeta del Comercio & Servicio -->
          <div class="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
            <div class="w-14 h-14 rounded-xl overflow-hidden bg-white flex-shrink-0 border border-slate-200">
              <img src="${apt.businessImage || './src/assets/reservas_cr_clean_badge_1.jpg'}" alt="${apt.businessName}" class="w-full h-full object-cover">
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-extrabold text-sm text-slate-900 truncate">${apt.businessName}</h3>
              <p class="text-xs text-blue-600 font-bold">${apt.serviceName}</p>
              <p class="text-[11px] text-slate-400 mt-0.5">Atendido el ${this.formatDateDMY(apt.date)} • ${this.formatTime12h(apt.time)}</p>
            </div>
          </div>

          <!-- Selector Interactivo de Estrellas -->
          <form id="review-submission-form" class="space-y-6">
            <div class="text-center space-y-3">
              <label class="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Selecciona tu puntuación:
              </label>
              
              <div class="flex items-center justify-center gap-2 sm:gap-3 py-2" id="star-rating-selector">
                ${[1, 2, 3, 4, 5].map(num => `
                  <button 
                    type="button" 
                    class="star-select-btn text-3xl sm:text-4xl transition-transform hover:scale-125 focus:outline-none cursor-pointer ${num <= currentSelectedRating ? 'text-amber-400' : 'text-slate-300'}" 
                    data-rating="${num}"
                    title="${ratingLabels[num]}"
                  >
                    ★
                  </button>
                `).join('')}
              </div>

              <div id="rating-label-display" class="text-sm font-black text-blue-600 transition-all">
                ${ratingLabels[currentSelectedRating]}
              </div>
            </div>

            <!-- Comentario -->
            <div class="space-y-1.5">
              <label for="review-comment" class="block text-xs font-bold text-slate-700">
                Tu opinión o comentario (Opcional):
              </label>
              <textarea 
                id="review-comment" 
                rows="4" 
                class="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-xs text-slate-800 transition-all resize-none"
                placeholder="Cuéntanos qué tal la puntualidad, el trato del personal, las instalaciones y si recomendarías el lugar..."
              ></textarea>
              >${allowEdit && review?.comment ? this.escapeHtml(review.comment) : ''}</textarea>
            </div>

            <!-- Botón de Envío -->
            <button 
              type="submit" 
              id="submit-review-btn" 
              class="w-full py-3.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
            >
              <i class="fas fa-paper-plane"></i> Publicar Reseña Verificada
            </button>
          </form>

        </div>
      </div>
    `;

    // Listeners del selector de estrellas
    const starBtns = document.querySelectorAll('.star-select-btn');
    const labelDisplay = document.getElementById('rating-label-display');

    const updateStarsVisual = (rating) => {
      starBtns.forEach(btn => {
        const r = parseInt(btn.getAttribute('data-rating'), 10);
        if (r <= rating) {
          btn.classList.remove('text-slate-300');
          btn.classList.add('text-amber-400');
        } else {
          btn.classList.remove('text-amber-400');
          btn.classList.add('text-slate-300');
        }
      });
      if (labelDisplay) {
        labelDisplay.textContent = ratingLabels[rating] || '';
      }
    };

    starBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        currentSelectedRating = parseInt(btn.getAttribute('data-rating'), 10);
        updateStarsVisual(currentSelectedRating);
      });
      btn.addEventListener('mouseenter', () => {
        const hoverRating = parseInt(btn.getAttribute('data-rating'), 10);
        updateStarsVisual(hoverRating);
      });
    });

    document.getElementById('star-rating-selector')?.addEventListener('mouseleave', () => {
      updateStarsVisual(currentSelectedRating);
    });

    // Envío del Formulario
    document.getElementById('review-submission-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('submit-review-btn');
      const comment = document.getElementById('review-comment')?.value || '';

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Publicando reseña...';
      }

      try {
        const res = await storage.submitReview({
          appointmentId: apt.id,
          rating: currentSelectedRating,
          comment: comment.trim()
        });

        this.showToast('¡Muchas gracias! Tu reseña ha sido publicada con éxito.', 'success');
        
        // Renderizar vista de agradecimiento
        await this.renderReviewBookingView(container, appointmentId);
      } catch (err) {
        console.error('Error enviando reseña:', err);
        this.showToast(err.message || 'No se pudo publicar la reseña.', 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Publicar Reseña Verificada';
        }
      }
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
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 my-0 sm:my-8 mobile-bottom-sheet flex flex-col max-h-[92vh]">
          <!-- Header -->
          <div class="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 sm:p-6 text-white flex items-center justify-between shrink-0">
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

      const isAutoConfirm = biz.autoConfirmAppointments !== false;
      const initialStatus = isAutoConfirm ? 'confirmed' : 'pending';

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
        status: initialStatus
      });

      this.closeBookingModal();
      this.renderSuccessBookingModal(newAppointment, biz);
      if (newAppointment.status === 'pending') {
        this.showToast('¡Solicitud enviada! En unos minutos recibirás la confirmación del negocio.', 'info');
      } else {
        this.showToast('¡Reserva confirmada con éxito!', 'success');
      }
    });
  }

  // --- MODAL DE ÉXITO DE RESERVA (CONFIRMADA O PENDIENTE) ---
  renderSuccessBookingModal(appointment, business) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const isPending = appointment.status === 'pending';

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 text-center p-6 sm:p-8">
          <div class="w-16 h-16 ${isPending ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'} rounded-full flex items-center justify-center text-3xl mx-auto mb-4 ${isPending ? 'animate-pulse' : 'animate-bounce'}">
            <i class="fas ${isPending ? 'fa-hourglass-half' : 'fa-check'}"></i>
          </div>

          <span class="text-xs uppercase font-extrabold ${isPending ? 'text-amber-600' : 'text-emerald-600'} tracking-wider">
            ${isPending ? '¡Solicitud de Reserva Recibida!' : '¡Turno Agendado!'}
          </span>
          <h3 class="text-2xl font-black text-slate-900 mt-1">
            ${isPending ? 'Cita en Proceso de Confirmación' : 'Cita Confirmada'}
          </h3>
          <p class="text-xs text-slate-500 mt-1">Código de reserva: <strong class="text-slate-800 font-mono">${appointment.id.toUpperCase()}</strong></p>

          ${isPending ? `
            <!-- Aviso Informativo para Cita Pendiente -->
            <div class="mt-4 p-4 bg-amber-50/90 rounded-2xl border border-amber-200 text-left text-xs text-amber-900 space-y-1.5 animate-fade-in">
              <div class="flex items-center gap-2 font-bold text-amber-950">
                <i class="fas fa-clock text-amber-600 text-sm"></i>
                <span>En unos minutos te llegará la confirmación</span>
              </div>
              <p class="text-amber-800 text-[11px] leading-relaxed">
                Tu solicitud ha sido enviada al comercio <strong>${business.name}</strong>. En unos minutos te llegará la confirmación por parte del negocio vía correo y WhatsApp una vez sea revisada y aprobada.
              </p>
            </div>
          ` : ''}

          <div class="mt-5 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left text-xs space-y-2.5">
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
              <span class="font-bold text-blue-600">${this.formatDateDMY(appointment.date)} a las ${this.formatTime12h(appointment.time)}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-500">Estado:</span>
              <span class="font-bold ${isPending ? 'text-amber-600' : 'text-emerald-600'} flex items-center gap-1">
                <i class="fas ${isPending ? 'fa-clock' : 'fa-check-circle'} text-[11px]"></i>
                ${isPending ? 'Pendiente de aprobación' : 'Confirmada al instante'}
              </span>
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

          ${!isPending && appointment.whatsappOptIn !== false ? `
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
            <button id="success-view-bookings-btn" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 cursor-pointer">
              Ver Mis Reservas
            </button>
            <button id="success-done-btn" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer">
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
                    <button class="client-rate-btn px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-xs" data-apt-id="${apt.id}">
                      <i class="fas fa-star text-amber-500"></i> Calificar Atención
                    </button>
                    <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 flex items-center gap-1">
                      <i class="fas fa-check-circle"></i> Atendida
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

    document.querySelectorAll('.client-rate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const aptId = btn.getAttribute('data-apt-id');
        this.navigateTo('review-booking', { appointmentId: aptId });
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

    // Métricas del Plan de Suscripción ($6, $15, $25)
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthAppointments = appointments.filter(a => (a.date || '').startsWith(currentMonth));
    const currentPlanId = currentBiz.plan || 'basic';
    const planConfig = storage.getPlanById(currentPlanId) || { id: 'basic', name: 'Plan Básico', priceUsd: 6, bookingLimit: 150 };
    const monthlyLimit = (currentBiz.monthlyBookingLimit !== undefined && currentBiz.monthlyBookingLimit !== null) ? currentBiz.monthlyBookingLimit : planConfig.bookingLimit;
    const isUnlimited = monthlyLimit === null || monthlyLimit === undefined || monthlyLimit < 0;
    const usageCount = monthAppointments.length;
    const percentUsed = isUnlimited ? 0 : Math.min(100, Math.round((usageCount / (monthlyLimit || 1)) * 100));

    container.innerHTML = `
      <div class="animate-fade-in pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <!-- Top Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs mb-6">
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
            <button id="dash-logout-btn" class="px-4 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer">
              <i class="fas fa-sign-out-alt mr-1"></i> Salir del Panel
            </button>
          </div>
        </div>

        <!-- Banner de Suscripción y Cuota Mensual -->
        <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 sm:p-6 rounded-3xl border border-indigo-500/30 shadow-lg mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div class="space-y-1.5 max-w-xl">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-3 py-1 rounded-full ${currentPlanId === 'unlimited' ? 'bg-purple-500 text-white' : currentPlanId === 'pro' ? 'bg-amber-400 text-slate-950' : 'bg-blue-500 text-white'} text-xs font-black uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                <i class="fas ${currentPlanId === 'unlimited' ? 'fa-infinity' : currentPlanId === 'pro' ? 'fa-crown' : 'fa-check'}"></i>
                ${planConfig.name}
              </span>
              <span class="text-xs text-amber-300 font-extrabold bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
                $${planConfig.priceUsd} USD / mes (~${this.formatColones(planConfig.priceCrc || (planConfig.priceUsd * 530))})
              </span>
            </div>
            <h3 class="text-lg font-black text-white">Consumo de Reservas del Mes (${new Date().toLocaleString('es-CR', { month: 'long', year: 'numeric' })})</h3>
            <p class="text-xs text-slate-300">
              ${isUnlimited 
                ? `🚀 Tu comercio cuenta con el <strong>Plan Ilimitado</strong>. Puedes recibir todas las citas que desees sin restricciones ni comisiones.`
                : `Has recibido <strong>${usageCount}</strong> de <strong>${monthlyLimit}</strong> reservas mensuales permitidas este mes.`}
            </p>
          </div>

          <div class="w-full md:w-80 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-xs space-y-3">
            ${!isUnlimited ? `
              <div class="space-y-1.5">
                <div class="flex justify-between text-xs font-bold">
                  <span class="text-slate-300">Progreso mensual</span>
                  <span class="${percentUsed > 90 ? 'text-rose-400' : percentUsed > 75 ? 'text-amber-400' : 'text-emerald-400'}">${usageCount} / ${monthlyLimit}</span>
                </div>
                <div class="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700">
                  <div class="h-full rounded-full transition-all duration-500 ${percentUsed > 90 ? 'bg-rose-500' : percentUsed > 75 ? 'bg-amber-400' : 'bg-emerald-500'}" style="width: ${percentUsed}%"></div>
                </div>
                <div class="flex justify-between text-[11px] text-slate-400 font-medium">
                  <span>${percentUsed}% ocupado</span>
                  <span>${monthlyLimit - usageCount > 0 ? `${monthlyLimit - usageCount} restantes` : 'Cupo alcanzado'}</span>
                </div>
              </div>
            ` : `
              <div class="text-center py-1">
                <div class="inline-flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <i class="fas fa-check-double"></i>
                  <span>Sin límite de reservas</span>
                </div>
                <p class="text-[11px] text-slate-400 mt-0.5">${usageCount} citas recibidas este mes</p>
              </div>
            `}

            <button id="dash-change-plan-btn" class="w-full py-2 px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 cursor-pointer">
              <i class="fas fa-arrow-up-right-from-square text-xs"></i>
              <span>Cambiar o Mejorar Plan</span>
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
          <button class="dash-tab-btn px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${this.activeDashboardTab === 'blocked-slots' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100'}" data-tab="blocked-slots">
            <i class="fas fa-calendar-times mr-1.5 text-rose-400"></i> Bloqueos y Horas
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

    document.getElementById('dash-change-plan-btn')?.addEventListener('click', () => {
      this.renderPlansModal({ businessId: currentBiz.id, currentPlanId });
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

      const isAutoConfirm = currentBiz.autoConfirmAppointments !== false;

      return `
        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 class="text-lg font-bold text-slate-900">Agenda y Reservas</h2>
              <p class="text-xs text-slate-500">Gestiona, acepta, reprograma, cancela y actualiza reservas en tiempo real.</p>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              ${currentBiz.plan === 'unlimited' ? `
                <button id="dash-export-csv-btn" class="px-3.5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer">
                  <i class="fas fa-file-csv text-purple-600"></i> Exportar Clientes (CSV)
                </button>
              ` : `
                <button id="dash-upgrade-prompt-btn" class="px-3.5 py-2.5 bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-purple-800 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer" title="Exportar base de clientes está incluido en el Plan Ilimitado">
                  <i class="fas fa-crown text-amber-500"></i> Base de Clientes (Plan ∞)
                </button>
              `}
              <button id="add-manual-appointment-btn" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-500/20 cursor-pointer">
                <i class="fas fa-plus-circle"></i> Nueva Reserva Manual
              </button>
            </div>
          </div>

          <!-- Banner Informativo con Switch de Autoconfirmación de Citas -->
          <div class="mb-6 p-4 sm:p-5 rounded-2xl border transition-all ${isAutoConfirm ? 'bg-emerald-50/70 border-emerald-200/80 shadow-xs' : 'bg-amber-50/80 border-amber-200/90 shadow-xs'}">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div class="space-y-1.5">
                <div class="flex items-center gap-2 flex-wrap">
                  <div class="w-7 h-7 rounded-xl flex items-center justify-center text-xs ${isAutoConfirm ? 'bg-emerald-600 text-white shadow-xs' : 'bg-amber-500 text-slate-950 shadow-xs'}">
                    <i class="fas ${isAutoConfirm ? 'fa-magic' : 'fa-hand-paper'}"></i>
                  </div>
                  <h3 class="text-sm font-black text-slate-900">Autoconfirmación de Citas</h3>
                  <span class="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full ${isAutoConfirm ? 'bg-emerald-200/70 text-emerald-900 border border-emerald-300/60' : 'bg-amber-200/80 text-amber-950 border border-amber-300/70'}">
                    ${isAutoConfirm ? '⚡ Modo Automático Activo' : '✋ Modo Manual (Aprobación Requerida)'}
                  </span>
                </div>
                <p class="text-xs text-slate-700 leading-relaxed max-w-3xl">
                  ${isAutoConfirm ? `
                    <strong>¿Para qué sirve?</strong> Al estar <strong>activa</strong>, las reservas generadas por tus clientes en la página se confirman inmediatamente y el sistema les envía en el acto la confirmación por <strong>correo electrónico y WhatsApp</strong>.
                  ` : `
                    <strong>¿Para qué sirve?</strong> Al estar <strong>inactiva</strong>, cada nueva cita entrará en estado <strong>Pendiente</strong>. El cliente verá un aviso en la página indicándole que <em>en unos minutos recibirá la confirmación</em>. El correo y WhatsApp se enviarán únicamente hasta que presiones <strong>"Aceptar"</strong> en la reserva.
                  `}
                </p>
              </div>

              <!-- Switch Toggle -->
              <div class="flex items-center gap-3 self-start sm:self-center bg-white/80 backdrop-blur-xs px-3.5 py-2 rounded-2xl border border-slate-200/80 shadow-2xs flex-shrink-0">
                <div class="text-right">
                  <span class="block text-xs font-black ${isAutoConfirm ? 'text-emerald-700' : 'text-slate-600'}">
                    ${isAutoConfirm ? 'Autoconfirmar' : 'Confirmación Manual'}
                  </span>
                  <span class="block text-[10px] text-slate-400">
                    ${isAutoConfirm ? 'Instantáneo' : 'Requiere Aprobación'}
                  </span>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" id="toggle-auto-confirm-switch" class="sr-only peer" ${isAutoConfirm ? 'checked' : ''}>
                  <div class="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>
          </div>

          <!-- Filtros de Estado para el Dueño -->
          <div class="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
            <button class="owner-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === 'all' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}" data-filter="all">
              Todas (${appointments.length})
          <!-- Filtros de Estado y Botón de Bloqueo Rápido -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div class="flex items-center gap-2 overflow-x-auto pb-1">
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

            <button id="quick-manage-slots-btn" class="px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center gap-1.5 shadow-sm shadow-blue-500/20 flex-shrink-0 cursor-pointer">
              <i class="fas fa-calendar-times"></i> Bloquear / Liberar Horas
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

    if (this.activeDashboardTab === 'blocked-slots') {
      return this.renderBlockedSlotsTabContent(currentBiz, appointments);
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
            <div class="flex items-center gap-2">
              <button id="quick-manage-slots-from-services-btn" class="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer">
                <i class="fas fa-calendar-times"></i> Gestionar Horas
              </button>
              <button id="add-new-service-btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer">
                <i class="fas fa-plus"></i> Agregar Servicio
              </button>
            </div>
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

            <!-- Redes Sociales y Enlaces Web -->
            <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div class="flex items-center justify-between">
                <h3 class="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <i class="fas fa-share-alt text-blue-600"></i> Redes Sociales & Sitio Web
                </h3>
                <span class="text-[11px] text-slate-400 font-medium">Visibles para tus clientes</span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-pink-600 text-sm">
                    <i class="fab fa-instagram"></i>
                  </div>
                  <input type="text" id="edit-biz-instagram" value="${currentBiz.socialLinks?.instagram || currentBiz.social_links?.instagram || ''}" placeholder="Instagram (@minegocio o URL)" class="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-pink-400 focus:outline-none">
                </div>

                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-600 text-sm">
                    <i class="fab fa-facebook"></i>
                  </div>
                  <input type="text" id="edit-biz-facebook" value="${currentBiz.socialLinks?.facebook || currentBiz.social_links?.facebook || ''}" placeholder="Facebook (usuario o enlace)" class="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none">
                </div>

                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-900 text-sm">
                    <i class="fab fa-tiktok"></i>
                  </div>
                  <input type="text" id="edit-biz-tiktok" value="${currentBiz.socialLinks?.tiktok || currentBiz.social_links?.tiktok || ''}" placeholder="TikTok (@minegocio)" class="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-400 focus:outline-none">
                </div>

                <div class="relative">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-600 text-sm">
                    <i class="fas fa-globe"></i>
                  </div>
                  <input type="text" id="edit-biz-website" value="${currentBiz.socialLinks?.website || currentBiz.social_links?.website || ''}" placeholder="Sitio Web / Menú Digital (https://...)" class="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none">
                </div>
              </div>
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
      const sch = currentBiz.schedule || { days: [1, 2, 3, 4, 5, 6], openTime: '08:00', closeTime: '18:00', slotDuration: 30 };
      const currentSlotDuration = sch.slotDuration === 15 ? 15 : 30;
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

            <!-- Intervalo de Franjas Horarias (15 min vs 30 min) -->
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <label class="block font-bold text-slate-800 text-xs uppercase tracking-wider">Intervalo de Turnos / Horarios</label>
                  <p class="text-[11px] text-slate-500">Elige la duración de cada bloque horario para las citas públicas y el bloqueo de agenda.</p>
                </div>
                <div class="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-sm flex-shrink-0">
                  <i class="fas fa-stopwatch"></i>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label class="flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${currentSlotDuration === 15 ? 'bg-blue-50/90 border-blue-500 text-blue-950 font-bold ring-2 ring-blue-500/20 shadow-xs' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}">
                  <input type="radio" name="slot_duration" value="15" ${currentSlotDuration === 15 ? 'checked' : ''} class="text-blue-600 focus:ring-blue-500 w-4 h-4">
                  <div>
                    <span class="block text-xs font-bold text-slate-900">Cada 15 Minutos</span>
                    <span class="block text-[10px] text-slate-500">Ej: 8:00, 8:15, 8:30, 8:45...</span>
                  </div>
                </label>
                <label class="flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${currentSlotDuration === 30 ? 'bg-blue-50/90 border-blue-500 text-blue-950 font-bold ring-2 ring-blue-500/20 shadow-xs' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}">
                  <input type="radio" name="slot_duration" value="30" ${currentSlotDuration === 30 ? 'checked' : ''} class="text-blue-600 focus:ring-blue-500 w-4 h-4">
                  <div>
                    <span class="block text-xs font-bold text-slate-900">Cada 30 Minutos (Estándar)</span>
                    <span class="block text-[10px] text-slate-500">Ej: 8:00, 8:30, 9:00, 9:30...</span>
                  </div>
                </label>
              </div>
            </div>

            <!-- Autoconfirmación de Citas en Horarios -->
            <div class="p-5 rounded-2xl border transition-all ${currentBiz.autoConfirmAppointments !== false ? 'bg-emerald-50/70 border-emerald-200/80 shadow-xs' : 'bg-amber-50/80 border-amber-200/90 shadow-xs'} space-y-3">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <i class="fas ${currentBiz.autoConfirmAppointments !== false ? 'fa-magic text-emerald-600' : 'fa-hand-paper text-amber-600'} text-base"></i>
                    <span class="font-bold text-slate-900 text-sm">Autoconfirmación de Citas</span>
                    <span class="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full ${currentBiz.autoConfirmAppointments !== false ? 'bg-emerald-200/70 text-emerald-900' : 'bg-amber-200/80 text-amber-950'}">
                      ${currentBiz.autoConfirmAppointments !== false ? '⚡ Automático' : '✋ Manual'}
                    </span>
                  </div>
                  <p class="text-xs text-slate-600 leading-relaxed">
                    ${currentBiz.autoConfirmAppointments !== false
                      ? 'Las citas se confirman inmediatamente y se envía WhatsApp y correo al cliente al agendar.'
                      : 'Las citas entran en estado Pendiente y requieren tu confirmación antes de enviar WhatsApp y correo.'}
                  </p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer flex-shrink-0 self-start sm:self-center">
                  <input type="checkbox" class="toggle-auto-confirm-input sr-only peer" ${currentBiz.autoConfirmAppointments !== false ? 'checked' : ''}>
                  <div class="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
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

  // --- SUB-CONTENIDO: BLOQUEOS Y GESTIÓN VISUAL DE HORARIOS ---
  renderBlockedSlotsTabContent(currentBiz, appointments) {
    const selectedDate = this.selectedBlockedSlotsDate || this.getTodayDateString();
    const sch = currentBiz.schedule || { days: [1, 2, 3, 4, 5, 6], openTime: '08:00', closeTime: '18:00', slotDuration: 30 };
    
    // Calcular día de la semana para saber si labora normalmente
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    const isWorkingDay = sch.days && sch.days.includes(dayOfWeek);

    const timeToMinutes = (timeStr) => {
      if (!timeStr) return 0;
      let str = String(timeStr).trim().toUpperCase();
      const isPM = str.includes('PM');
      const isAM = str.includes('AM');
      str = str.replace(/[APM\s]/g, '');
      const [hStr, mStr] = str.split(':');
      let h = parseInt(hStr, 10) || 0;
      const min = parseInt(mStr, 10) || 0;
      if (isPM && h < 12) h += 12;
      if (isAM && h === 12) h = 0;
      return h * 60 + min;
    };

    const minutesToTime = (totalMinutes) => {
      const totalH = Math.floor(totalMinutes / 60);
      const min = (totalMinutes % 60).toString().padStart(2, '0');
      const period = totalH >= 12 ? 'PM' : 'AM';
      let hour12 = totalH % 12;
      if (hour12 === 0) hour12 = 12;
      return `${hour12}:${min} ${period}`;
    };

    const openMin = timeToMinutes(sch.openTime || '08:00');
    const closeMin = timeToMinutes(sch.closeTime || '18:00');
    const breakStartMin = sch.breakStart ? timeToMinutes(sch.breakStart) : -1;
    const breakEndMin = sch.breakEnd ? timeToMinutes(sch.breakEnd) : -1;
    const slotStep = sch.slotDuration || 30;

    // Citas existentes del día
    const dayAppointments = appointments.filter(a => a.date === selectedDate && a.status !== 'cancelled');
    const bookedRanges = dayAppointments.map(appt => {
      const start = timeToMinutes(appt.time);
      const duration = appt.serviceDuration || 30;
      return { start, end: start + duration, appointment: appt };
    });

    // Franjas bloqueadas por el comercio
    const blockedSlots = storage.getBlockedSlots(currentBiz.id, selectedDate);
    const blockedTimesSet = new Set(blockedSlots.map(b => b.time));

    // Generar todas las franjas
    const slots = [];
    for (let current = openMin; current + slotStep <= closeMin; current += slotStep) {
      const slotEnd = current + slotStep;
      const timeStr = minutesToTime(current);

      const bookedOverlap = bookedRanges.find(b => current < b.end && slotEnd > b.start);
      const isManualBlocked = blockedSlots.some(b => {
        const bStart = timeToMinutes(b.time);
        const is15 = (bStart % 30 !== 0);
        const bDur = is15 ? 15 : (slotStep === 15 ? 15 : 30);
        return current < (bStart + bDur) && slotEnd > bStart;
      });
      const isBreak = (breakStartMin !== -1 && breakEndMin !== -1 && current < breakEndMin && slotEnd > breakStartMin);

      let status = 'available'; // 'available' | 'blocked' | 'booked' | 'break'
      let aptInfo = null;

      if (bookedOverlap) {
        status = 'booked';
        aptInfo = bookedOverlap.appointment;
      } else if (isManualBlocked) {
        status = 'blocked';
      } else if (isBreak) {
        status = 'break';
      }

      slots.push({
        timeStr,
        currentMin: current,
        status,
        appointment: aptInfo
      });
    }

    const availableCount = slots.filter(s => s.status === 'available').length;
    const blockedCount = slots.filter(s => s.status === 'blocked').length;
    const bookedCount = slots.filter(s => s.status === 'booked').length;
    const breakCount = slots.filter(s => s.status === 'break').length;

    const todayStr = this.getTodayDateString();
    const tomorrowObj = new Date();
    tomorrowObj.setDate(tomorrowObj.getDate() + 1);
    const tomorrowStr = tomorrowObj.toISOString().slice(0, 10);
    const dayAfterObj = new Date();
    dayAfterObj.setDate(dayAfterObj.getDate() + 2);
    const dayAfterStr = dayAfterObj.toISOString().slice(0, 10);

    return `
      <div class="space-y-6 animate-fade-in">
        <!-- Banner Explicativo -->
        <div class="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 text-white shadow-lg border border-blue-800/40 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="space-y-2">
            <div class="inline-flex items-center gap-2 bg-blue-500/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-blue-300 border border-blue-400/30">
              <i class="fas fa-magic"></i> Control Total de Disponibilidad
            </div>
            <h2 class="text-xl sm:text-2xl font-black">Bloqueo y Liberación de Horarios</h2>
            <p class="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Toca cualquier franja horaria para <strong>bloquearla</strong> (rojo) o <strong>liberarla</strong> (verde) al instante. Los horarios bloqueados no estarán disponibles para que los clientes reserven en la página.
            </p>
          </div>

          <div class="flex flex-wrap sm:flex-nowrap items-center gap-2 flex-shrink-0">
            <button id="btn-block-all-day" class="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer">
              <i class="fas fa-lock"></i> Bloquear Todo el Día
            </button>
            <button id="btn-unblock-all-day" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer">
              <i class="fas fa-unlock"></i> Liberar Todo el Día
            </button>
          </div>
        </div>

        <!-- Selector de Fecha y Barra de Estado -->
        <div class="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <!-- Navegación de Fecha -->
            <div class="flex items-center gap-2 flex-wrap">
              <button id="btn-prev-day" class="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors text-xs font-bold cursor-pointer" title="Día Anterior">
                <i class="fas fa-chevron-left"></i>
              </button>

              <div class="relative">
                <input type="date" id="blocked-slots-date-picker" value="${selectedDate}" class="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer">
              </div>

              <button id="btn-next-day" class="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors text-xs font-bold cursor-pointer" title="Día Siguiente">
                <i class="fas fa-chevron-right"></i>
              </button>

              <!-- Atajos Rápidos de Fecha -->
              <div class="flex items-center gap-1.5 ml-1">
                <button class="quick-date-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedDate === todayStr ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-date="${todayStr}">
                  Hoy
                </button>
                <button class="quick-date-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedDate === tomorrowStr ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-date="${tomorrowStr}">
                  Mañana
                </button>
                <button class="quick-date-btn px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${selectedDate === dayAfterStr ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-date="${dayAfterStr}">
                  Pasado Mañana
                </button>
              </div>
            </div>

            <!-- Título de Fecha Seleccionada -->
            <div class="text-left lg:text-right">
              <h3 class="text-base sm:text-lg font-black text-slate-900 capitalize">
                ${this.formatDateFullSpanish(selectedDate)}
              </h3>
              <div class="flex items-center lg:justify-end gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
                <span class="inline-flex items-center gap-1">
                  <i class="far fa-clock text-blue-600"></i> Horario: <strong>${this.formatTime12h(sch.openTime || '08:00')} - ${this.formatTime12h(sch.closeTime || '18:00')}</strong> (cada ${slotStep}m)
                </span>
                ${!isWorkingDay ? `
                  <span class="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-bold text-[10px]">
                    ⚠️ Día No Laboral según Horarios
                  </span>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- Leyenda de Estados y Contadores -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-200 flex-shrink-0"></span>
                <div>
                  <span class="text-xs font-black block">Disponibles</span>
                  <span class="text-[10px] text-emerald-700">Libres para reservar</span>
                </div>
              </div>
              <span class="text-lg font-black text-emerald-800">${availableCount}</span>
            </div>

            <div class="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200 text-rose-900 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-3.5 h-3.5 rounded-full bg-rose-500 ring-4 ring-rose-200 flex-shrink-0"></span>
                <div>
                  <span class="text-xs font-black block">Bloqueados</span>
                  <span class="text-[10px] text-rose-700">Pausados por ti</span>
                </div>
              </div>
              <span class="text-lg font-black text-rose-800">${blockedCount}</span>
            </div>

            <div class="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-900 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-3.5 h-3.5 rounded-full bg-blue-600 ring-4 ring-blue-200 flex-shrink-0"></span>
                <div>
                  <span class="text-xs font-black block">Citas Clientes</span>
                  <span class="text-[10px] text-blue-700">Ya agendadas</span>
                </div>
              </div>
              <span class="text-lg font-black text-blue-800">${bookedCount}</span>
            </div>

            <div class="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-3.5 h-3.5 rounded-full bg-slate-400 ring-4 ring-slate-200 flex-shrink-0"></span>
                <div>
                  <span class="text-xs font-black block">Receso / Almuerzo</span>
                  <span class="text-[10px] text-slate-500">Horario de descanso</span>
                </div>
              </div>
              <span class="text-lg font-black text-slate-700">${breakCount}</span>
            </div>
          </div>

          <!-- Cuadrícula Interactiva de Franjas Horarias -->
          <div class="pt-2">
            <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              ${slots.map(slot => {
                if (slot.status === 'booked') {
                  const apt = slot.appointment;
                  return `
                    <button class="slot-booked-btn group relative p-3.5 rounded-2xl border-2 border-blue-300 bg-blue-50/90 text-blue-950 text-left transition-all hover:shadow-md hover:border-blue-500 cursor-pointer flex flex-col justify-between" data-apt-id="${apt.id}">
                      <div class="flex items-center justify-between">
                        <span class="font-extrabold text-sm text-blue-950 font-mono">${this.formatTime12h(slot.timeStr)}</span>
                        <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                      </div>
                      <div class="mt-2 text-[11px] font-bold truncate text-blue-900" title="${this.escapeHtml(apt.clientName)}">
                        <i class="far fa-user text-blue-600 mr-1"></i>${apt.clientName}
                      </div>
                      <div class="text-[10px] text-blue-700 truncate mt-0.5">
                        ${apt.serviceName}
                      </div>
                      <span class="mt-2 text-[9px] font-black uppercase text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md inline-block text-center">
                        Cita #${apt.id.toUpperCase().slice(-4)}
                      </span>
                    </button>
                  `;
                }

                if (slot.status === 'blocked') {
                  return `
                    <button class="interactive-slot-btn p-3.5 rounded-2xl border-2 border-rose-300 bg-rose-50 text-rose-950 text-left transition-all hover:bg-rose-100 hover:border-rose-400 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col justify-between shadow-2xs" data-time="${slot.timeStr}" data-status="blocked" title="Toca para desbloquear y poner disponible">
                      <div class="flex items-center justify-between">
                        <span class="font-black text-sm text-rose-950 font-mono">${this.formatTime12h(slot.timeStr)}</span>
                        <i class="fas fa-lock text-rose-600 text-xs"></i>
                      </div>
                      <div class="mt-3 flex items-center justify-between">
                        <span class="text-[10px] font-black uppercase tracking-wider text-rose-700 bg-rose-200/80 px-2 py-0.5 rounded-md">
                          Bloqueado
                        </span>
                        <span class="text-[10px] text-rose-600 font-bold">
                          Liberar <i class="fas fa-arrow-right text-[9px]"></i>
                        </span>
                      </div>
                    </button>
                  `;
                }

                if (slot.status === 'break') {
                  return `
                    <div class="p-3.5 rounded-2xl border border-slate-200 bg-slate-100 text-slate-500 text-left flex flex-col justify-between opacity-80 cursor-not-allowed">
                      <div class="flex items-center justify-between">
                        <span class="font-bold text-sm text-slate-600 font-mono">${this.formatTime12h(slot.timeStr)}</span>
                        <i class="fas fa-coffee text-slate-400 text-xs"></i>
                      </div>
                      <div class="mt-3">
                        <span class="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md">
                          Almuerzo / Receso
                        </span>
                      </div>
                    </div>
                  `;
                }

                // Default: available
                return `
                  <button class="interactive-slot-btn p-3.5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 text-emerald-950 text-left transition-all hover:bg-emerald-100/80 hover:border-emerald-500 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col justify-between shadow-2xs" data-time="${slot.timeStr}" data-status="available" title="Toca para bloquear esta hora">
                    <div class="flex items-center justify-between">
                      <span class="font-black text-sm text-emerald-950 font-mono">${this.formatTime12h(slot.timeStr)}</span>
                      <i class="fas fa-check-circle text-emerald-600 text-xs"></i>
                    </div>
                    <div class="mt-3 flex items-center justify-between">
                      <span class="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-md">
                        Disponible
                      </span>
                      <span class="text-[10px] text-emerald-700 font-bold">
                        Bloquear <i class="fas fa-ban text-[9px]"></i>
                      </span>
                    </div>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderBookedSlotAppointmentModal(apt) {
    const modalContainer = document.getElementById('modal-container') || document.createElement('div');
    modalContainer.id = 'modal-container';
    if (!document.getElementById('modal-container')) {
      document.body.appendChild(modalContainer);
    }

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
        <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100">
          <div class="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center text-lg">
                <i class="fas fa-calendar-check"></i>
              </div>
              <div>
                <span class="text-[10px] uppercase font-bold tracking-widest text-blue-200 block">Detalle de Reserva</span>
                <h3 class="text-base font-black">Cita #${apt.id.toUpperCase()}</h3>
              </div>
            </div>
            <button id="close-booked-slot-modal-btn" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer">
              <i class="fas fa-times"></i>
            </button>
          </div>

          <div class="p-6 space-y-4 text-xs">
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
              <div class="flex justify-between">
                <span class="text-slate-500">Cliente:</span>
                <span class="font-extrabold text-slate-900">${apt.clientName}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Teléfono:</span>
                <span class="font-bold text-slate-800">${apt.clientPhone}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Email:</span>
                <span class="font-medium text-slate-700">${apt.clientEmail || 'No especificado'}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Servicio:</span>
                <span class="font-bold text-blue-600">${apt.serviceName} (${apt.serviceDuration} min)</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Fecha y Hora:</span>
                <span class="font-extrabold text-slate-900">${this.formatDateDMY(apt.date)} a las ${this.formatTime12h(apt.time)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Monto:</span>
                <span class="font-black text-slate-900">${this.formatColones(apt.servicePrice)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Estado:</span>
                <span class="badge-status badge-status-${apt.status}">
                  ${apt.status === 'confirmed' ? 'Confirmada' : apt.status === 'pending' ? 'Pendiente' : apt.status === 'completed' ? 'Completada' : 'Cancelada'}
                </span>
              </div>
              ${apt.notes ? `
                <div class="pt-2 border-t border-slate-200">
                  <span class="text-slate-500 block mb-1">Notas del cliente:</span>
                  <div class="italic text-slate-700 bg-white p-2.5 rounded-xl border border-slate-100">${this.escapeHtml(apt.notes)}</div>
                </div>
              ` : ''}
            </div>

            <div class="flex items-center gap-2 pt-2">
              <button id="modal-manage-reschedule-btn" class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                <i class="fas fa-edit"></i> Modificar / Reagendar
              </button>
              <button id="close-booked-slot-modal-btn2" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('close-booked-slot-modal-btn')?.addEventListener('click', closeModal);
    document.getElementById('close-booked-slot-modal-btn2')?.addEventListener('click', closeModal);
    document.getElementById('modal-manage-reschedule-btn')?.addEventListener('click', () => {
      closeModal();
      this.renderRescheduleModal(apt, true);
    });
  }

  // --- LISTENERS ESPECÍFICOS DEL DASHBOARD ---
  setupDashboardTabEvents(currentBiz) {
    // Switch de Autoconfirmación de Citas (en Agenda y en Horarios)
    const handleAutoConfirmToggle = async (isChecked) => {
      await storage.updateBusinessAutoConfirm(currentBiz.id, isChecked);
      currentBiz.autoConfirmAppointments = isChecked;
      this.showToast(
        isChecked 
          ? '⚡ ¡Autoconfirmación activada! Las citas se confirmarán y notificarán al instante.' 
          : '✋ Modo manual activado: Las citas requerirán tu aprobación antes de enviar correo y WhatsApp.',
        'success'
      );
      this.renderCurrentView();
    };

    document.getElementById('toggle-auto-confirm-switch')?.addEventListener('change', async (e) => {
      await handleAutoConfirmToggle(e.target.checked);
    });

    document.querySelectorAll('.toggle-auto-confirm-input').forEach(input => {
      input.addEventListener('change', async (e) => {
        await handleAutoConfirmToggle(e.target.checked);
      });
    });

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
          confirmed: '✅ ¡Cita confirmada! Se enviaron las notificaciones por WhatsApp y correo al cliente.',
          completed: '🎉 ¡Reserva completada! Se envió automáticamente la solicitud de calificación por correo al cliente.',
          cancelled: '❌ Reserva cancelada.'
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

    document.getElementById('dash-export-csv-btn')?.addEventListener('click', () => {
      const appointments = storage.getAppointmentsByBusiness(currentBiz.id);
      if (appointments.length === 0) {
        this.showToast('No hay citas registradas para exportar.', 'info');
        return;
      }
      const headers = ['ID Cita', 'Fecha', 'Hora', 'Cliente', 'Teléfono', 'Email', 'Servicio', 'Precio CRC', 'Duración Min', 'Estado', 'Notas'];
      const rows = appointments.map(a => [
        `"${a.id}"`,
        `"${a.date}"`,
        `"${a.time}"`,
        `"${(a.clientName || '').replace(/"/g, '""')}"`,
        `"${a.clientPhone || ''}"`,
        `"${a.clientEmail || ''}"`,
        `"${(a.serviceName || '').replace(/"/g, '""')}"`,
        a.servicePrice || 0,
        a.serviceDuration || 30,
        `"${a.status}"`,
        `"${(a.notes || '').replace(/"/g, '""')}"`
      ]);
      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `clientes_${currentBiz.name.replace(/\s+/g, '_')}_${this.getTodayDateString()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      this.showToast('¡Base de datos de clientes exportada exitosamente!', 'success');
    });

    document.getElementById('dash-upgrade-prompt-btn')?.addEventListener('click', () => {
      this.renderPlansModal({ businessId: currentBiz.id, currentPlanId: currentBiz.plan });
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
      const instagram = document.getElementById('edit-biz-instagram')?.value.trim() || '';
      const facebook = document.getElementById('edit-biz-facebook')?.value.trim() || '';
      const tiktok = document.getElementById('edit-biz-tiktok')?.value.trim() || '';
      const website = document.getElementById('edit-biz-website')?.value.trim() || '';
      const socialLinks = { instagram, facebook, tiktok, website };
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
        features,
        socialLinks
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
      const slotDurationInput = document.querySelector('input[name="slot_duration"]:checked');
      const slotDuration = slotDurationInput ? parseInt(slotDurationInput.value, 10) : (currentBiz.schedule?.slotDuration || 30);

      currentBiz.schedule = {
        days: selectedDays,
        openTime,
        closeTime,
        breakStart: breakStart || null,
        breakEnd: breakEnd || null,
        slotDuration: slotDuration === 15 ? 15 : 30
      };

      await storage.saveBusiness(currentBiz);
      this.showToast('Horarios actualizados exitosamente.', 'success');
      this.renderCurrentView();
    });

    // Accesos Rápidos a Bloqueos desde otras pestañas
    document.getElementById('quick-manage-slots-btn')?.addEventListener('click', () => {
      this.activeDashboardTab = 'blocked-slots';
      this.renderCurrentView();
    });

    document.getElementById('quick-manage-slots-from-services-btn')?.addEventListener('click', () => {
      this.activeDashboardTab = 'blocked-slots';
      this.renderCurrentView();
    });

    // --- LISTENERS DE LA PESTAÑA BLOQUEOS Y HORAS ---
    const datePicker = document.getElementById('blocked-slots-date-picker');
    datePicker?.addEventListener('change', (e) => {
      if (e.target.value) {
        this.selectedBlockedSlotsDate = e.target.value;
        this.renderCurrentView();
      }
    });

    document.getElementById('btn-prev-day')?.addEventListener('click', () => {
      const cur = this.selectedBlockedSlotsDate || this.getTodayDateString();
      const [y, m, d] = cur.split('-').map(Number);
      const prevDate = new Date(y, m - 1, d - 1);
      const prevY = prevDate.getFullYear();
      const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');
      const prevD = String(prevDate.getDate()).padStart(2, '0');
      this.selectedBlockedSlotsDate = `${prevY}-${prevM}-${prevD}`;
      this.renderCurrentView();
    });

    document.getElementById('btn-next-day')?.addEventListener('click', () => {
      const cur = this.selectedBlockedSlotsDate || this.getTodayDateString();
      const [y, m, d] = cur.split('-').map(Number);
      const nextDate = new Date(y, m - 1, d + 1);
      const nextY = nextDate.getFullYear();
      const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
      const nextD = String(nextDate.getDate()).padStart(2, '0');
      this.selectedBlockedSlotsDate = `${nextY}-${nextM}-${nextD}`;
      this.renderCurrentView();
    });

    document.querySelectorAll('.quick-date-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedBlockedSlotsDate = btn.getAttribute('data-date');
        this.renderCurrentView();
      });
    });

    // Clic en Franja Horaria (Disponible o Bloqueada)
    document.querySelectorAll('.interactive-slot-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const timeStr = btn.getAttribute('data-time');
        const selectedDate = this.selectedBlockedSlotsDate || this.getTodayDateString();
        btn.classList.add('opacity-50', 'pointer-events-none');
        try {
          const res = await storage.toggleBlockedSlot(currentBiz.id, selectedDate, timeStr);
          if (res && res.action === 'blocked') {
            this.showToast(`🔒 Franja ${this.formatTime12h(timeStr)} bloqueada exitosamente.`, 'info');
          } else {
            this.showToast(`🔓 Franja ${this.formatTime12h(timeStr)} liberada y disponible para reservas.`, 'success');
          }
        } catch (err) {
          this.showToast('Error al actualizar disponibilidad de horario.', 'error');
        }
        this.renderCurrentView();
      });
    });

    // Clic en Cita Agendada (ver detalle)
    document.querySelectorAll('.slot-booked-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const aptId = btn.getAttribute('data-apt-id');
        const appointments = storage.getAppointmentsByBusiness(currentBiz.id);
        const apt = appointments.find(a => a.id === aptId);
        if (apt) {
          this.renderBookedSlotAppointmentModal(apt);
        }
      });
    });

    // Bloquear Todo el Día
    document.getElementById('btn-block-all-day')?.addEventListener('click', async () => {
      const selectedDate = this.selectedBlockedSlotsDate || this.getTodayDateString();
      const sch = currentBiz.schedule || { openTime: '08:00', closeTime: '18:00', slotDuration: 30 };
      
      const timeToMinutes = (timeStr) => {
        if (!timeStr) return 0;
        let str = String(timeStr).trim().toUpperCase();
        const isPM = str.includes('PM');
        const isAM = str.includes('AM');
        str = str.replace(/[APM\s]/g, '');
        const [hStr, mStr] = str.split(':');
        let h = parseInt(hStr, 10) || 0;
        const min = parseInt(mStr, 10) || 0;
        if (isPM && h < 12) h += 12;
        if (isAM && h === 12) h = 0;
        return h * 60 + min;
      };

      const minutesToTime = (totalMinutes) => {
        const totalH = Math.floor(totalMinutes / 60);
        const min = (totalMinutes % 60).toString().padStart(2, '0');
        const period = totalH >= 12 ? 'PM' : 'AM';
        let hour12 = totalH % 12;
        if (hour12 === 0) hour12 = 12;
        return `${hour12}:${min} ${period}`;
      };

      const openMin = timeToMinutes(sch.openTime || '08:00');
      const closeMin = timeToMinutes(sch.closeTime || '18:00');
      const slotStep = sch.slotDuration || 30;

      const allTimes = [];
      for (let cur = openMin; cur + slotStep <= closeMin; cur += slotStep) {
        allTimes.push(minutesToTime(cur));
      }

      if (confirm(`¿Deseas bloquear todas las franjas horarias (${allTimes.length} turnos) del día ${this.formatDateDMY(selectedDate)} para que nadie pueda agendar?`)) {
        await storage.setDayBlockedSlots(currentBiz.id, selectedDate, allTimes, 'block_all');
        this.showToast(`🔒 Todas las horas del ${this.formatDateDMY(selectedDate)} han sido bloqueadas.`, 'info');
        this.renderCurrentView();
      }
    });

    // Liberar Todo el Día
    document.getElementById('btn-unblock-all-day')?.addEventListener('click', async () => {
      const selectedDate = this.selectedBlockedSlotsDate || this.getTodayDateString();
      if (confirm(`¿Deseas eliminar todos los bloqueos manuales y restablecer la disponibilidad normal para el día ${this.formatDateDMY(selectedDate)}?`)) {
        await storage.setDayBlockedSlots(currentBiz.id, selectedDate, [], 'unblock_all');
        this.showToast(`🔓 Todos los bloqueos del ${this.formatDateDMY(selectedDate)} han sido eliminados.`, 'success');
        this.renderCurrentView();
      }
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
          <p class="text-sm text-slate-500 mb-6">Esta sección es de uso exclusivo para el equipo de desarrollo y administración de Reservas CR.</p>
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
      const [stats, businesses, clients, appointments, alerts, waSettings] = await Promise.all([
        storage.getDeveloperStats(),
        storage.getDeveloperBusinesses(),
        storage.getDeveloperClients(),
        storage.getDeveloperAppointments(),
        storage.getDeveloperCategoryAlerts(),
        storage.getWhatsAppSettings()
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

                <button id="dev-tab-appointments" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${this.activeDevTab === 'appointments' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
                  <i class="fas fa-calendar-alt"></i>
                  <span>Citas Globales (${appointments.length})</span>
                </button>

                <button id="dev-tab-whatsapp" class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${this.activeDevTab === 'whatsapp' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}">
                  <i class="fab fa-whatsapp ${this.activeDevTab === 'whatsapp' ? 'text-white' : 'text-emerald-600'}"></i>
                  <span>WhatsApp & Meta API</span>
                  ${waSettings.configured ? '<span class="w-2 h-2 rounded-full bg-emerald-400"></span>' : '<span class="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] rounded font-bold">Por Configurar</span>'}
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
                            <th class="p-3">Plan Activo</th>
                            <th class="p-3">Ubicación / Contacto</th>
                            <th class="p-3">Dueño / Correo</th>
                            <th class="p-3">Servicios</th>
                            <th class="p-3">Estado</th>
                            <th class="p-3">Tipo</th>
                            <th class="p-3 text-right">Acciones Developer</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-medium">
                          ${filteredBusinesses.map(b => `
                            <tr class="hover:bg-slate-50/80 transition-colors ${b.isBlocked ? 'bg-rose-50/30' : b.isHidden ? 'bg-amber-50/30' : ''}">
                              <td class="p-3">
                                <div class="flex items-center gap-3">
                                  <img src="${b.image || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80'}" alt="${b.name}" class="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs flex-shrink-0">
                                  <div>
                                    <span class="font-bold text-slate-900 block text-sm">${b.name}</span>
                                    <span class="text-[10px] text-slate-400 font-mono">ID: ${b.id}</span>
                                  </div>
                                </div>
                              </td>
                              <td class="p-3">
                                <span class="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-semibold text-[11px] block whitespace-nowrap">${b.categoryLabel || b.category}</span>
                              </td>
                              <td class="p-3 whitespace-nowrap">
                                <select 
                                  class="dev-change-plan-select text-xs font-bold px-2.5 py-1.5 rounded-xl border cursor-pointer transition-all shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-none ${b.plan === 'unlimited' ? 'bg-purple-100 text-purple-900 border-purple-300' : b.plan === 'pro' ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-blue-50 text-blue-900 border-blue-200'}" 
                                  data-id="${b.id}" 
                                  data-name="${b.name}"
                                >
                                  <option value="basic" ${b.plan === 'basic' ? 'selected' : ''}>🔹 Básico ($8 • 150)</option>
                                  <option value="pro" ${b.plan === 'pro' ? 'selected' : ''}>⭐ Pro ($15 • 300)</option>
                                  <option value="unlimited" ${b.plan === 'unlimited' ? 'selected' : ''}>🚀 Ilimitado ($25 • ∞)</option>
                                </select>
                              </td>
                              <td class="p-3">
                                <span class="block text-slate-800 font-semibold">${b.city || 'Costa Rica'}</span>
                                <span class="text-[10px] text-slate-400">${b.phone || 'Sin teléfono'}</span>
                              </td>
                              <td class="p-3">
                                <span class="block text-slate-800">${b.ownerName || (b.isDemo ? 'Demo Admin' : 'Registrado')}</span>
                                <span class="text-[10px] text-slate-400">${b.ownerEmail || b.email || 'N/A'}</span>
                              </td>
                              <td class="p-3">
                                <span class="font-bold text-slate-800">${b.servicesCount !== undefined ? b.servicesCount : (b.services ? b.services.length : 0)} servicios</span>
                              </td>
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
                              <td class="p-3 whitespace-nowrap">
                                ${b.isDemo ? `
                                  <span class="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded">Muestra</span>
                                ` : `
                                  <span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded">Real</span>
                                `}
                              </td>
                              <td class="p-3 text-right whitespace-nowrap">
                                <div class="flex items-center justify-end gap-1.5">
                                  <!-- Ver en Directorio -->
                                  <button class="dev-view-biz-btn p-2 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition-all" data-id="${b.id}" title="Ver página del comercio">
                                    <i class="fas fa-external-link-alt text-xs"></i>
                                  </button>

                                  <!-- Ocultar / Mostrar en Inicio -->
                                  ${b.isHidden ? `
                                    <button class="dev-toggle-visibility-btn px-2.5 py-1.5 bg-amber-100 hover:bg-emerald-100 text-amber-900 hover:text-emerald-900 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-xs" data-id="${b.id}" data-action="show" data-name="${b.name}" title="Hacer visible en la página principal">
                                      <i class="fas fa-eye text-emerald-600"></i> Mostrar
                                    </button>
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

              <!-- PESTAÑA 5: WHATSAPP & META CLOUD API -->
              ${this.activeDevTab === 'whatsapp' ? `
                <div class="space-y-6">
                  <!-- Header informativo -->
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 rounded-2xl text-white border border-emerald-500/30 shadow-md">
                    <div class="space-y-1">
                      <div class="flex items-center gap-2">
                        <span class="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
                          <i class="fab fa-whatsapp"></i>
                        </span>
                        <h3 class="text-lg font-black tracking-tight">Meta WhatsApp Cloud API (Oficial Directa)</h3>
                      </div>
                      <p class="text-xs text-slate-300">
                        Conexión oficial directa con los servidores de Meta Graph API. Incluye <strong>1.000 conversaciones gratis al mes</strong> sin intermediarios.
                      </p>
                    </div>

                    <div class="flex items-center gap-2">
                      <span class="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${waSettings.configured ? 'bg-emerald-500 text-slate-950' : 'bg-amber-500 text-slate-950'}">
                        <i class="fas ${waSettings.configured ? 'fa-check-circle' : 'fa-exclamation-triangle'}"></i>
                        <span>${waSettings.configured ? 'Conexión Directa Activa' : 'Faltan Credenciales'}</span>
                      </span>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <!-- Formulario de Credenciales (Guardar en Neon DB) -->
                    <div class="lg:col-span-7 bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                      <div>
                        <h4 class="text-sm font-black text-slate-900 flex items-center gap-2">
                          <i class="fas fa-key text-blue-600"></i>
                          <span>Configuración de Credenciales de Meta</span>
                        </h4>
                        <p class="text-xs text-slate-500 mt-0.5">
                          Al guardar aquí, se actualizan al instante en la base de datos PostgreSQL sin necesidad de reiniciar Render.
                        </p>
                      </div>

                      <form id="dev-save-wa-form" class="space-y-3.5 text-xs">
                        <div>
                          <label class="block font-bold text-slate-700 mb-1">
                            Token de Acceso de Meta (META_WHATSAPP_TOKEN) *
                          </label>
                          <div class="relative">
                            <input 
                              type="password" 
                              id="dev-wa-token" 
                              placeholder="${waSettings.hasToken ? 'Token configurado (' + waSettings.tokenMasked + ')' : 'Pega tu token EAA...'}" 
                              class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            >
                            <button type="button" id="dev-wa-token-toggle" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                              <i class="fas fa-eye"></i>
                            </button>
                          </div>
                          <span class="text-[10px] text-slate-400 block mt-1">Copiado desde Meta for Developers > WhatsApp > API Setup</span>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label class="block font-bold text-slate-700 mb-1">
                              Identificador del Teléfono (Phone Number ID) *
                            </label>
                            <input 
                              type="text" 
                              id="dev-wa-phone-id" 
                              value="${waSettings.phoneNumberId || ''}" 
                              placeholder="Ej. 109283746501928" 
                              class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            >
                          </div>
                          <div>
                            <label class="block font-bold text-slate-700 mb-1">
                              WABA ID (WhatsApp Business Account)
                            </label>
                            <input 
                              type="text" 
                              id="dev-wa-waba-id" 
                              value="${waSettings.wabaId || ''}" 
                              placeholder="Ej. 102938475610293" 
                              class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            >
                          </div>
                        </div>

                        <div class="pt-2">
                          <button 
                            type="submit" 
                            id="dev-save-wa-btn" 
                            class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <i class="fas fa-save"></i>
                            <span>Guardar Credenciales en Base de Datos</span>
                          </button>
                        </div>
                      </form>
                    </div>

                    <!-- Panel de Prueba en Vivo -->
                    <div class="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
                      <div class="space-y-3">
                        <div class="flex items-center gap-2 text-emerald-600">
                          <i class="fas fa-paper-plane"></i>
                          <h4 class="text-sm font-black text-slate-900">Probar Envío de WhatsApp en Vivo</h4>
                        </div>
                        <p class="text-xs text-slate-500">
                          Envía una notificación real de confirmación de reserva directamente a tu celular.
                        </p>

                        <div class="space-y-2">
                          <label class="block font-bold text-slate-700 text-xs">Teléfono de Prueba (Costa Rica o Internacional):</label>
                          <div class="flex gap-2">
                            <input 
                              type="text" 
                              id="dev-test-phone-input" 
                              value="62297240" 
                              placeholder="Ej. 62297240 o +50662297240" 
                              class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            >
                            <button 
                              type="button" 
                              id="dev-send-test-wa-btn" 
                              class="px-4 py-2.5 bg-slate-900 hover:bg-emerald-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all flex-shrink-0 cursor-pointer"
                            >
                              <i class="fas fa-play text-[10px]"></i>
                              <span>Enviar Test</span>
                            </button>
                          </div>
                        </div>

                        <!-- Consola de Resultados en Vivo -->
                        <div id="dev-wa-test-result-box" class="p-3.5 bg-slate-900 rounded-xl text-slate-200 font-mono text-[11px] min-h-[90px] max-h-[160px] overflow-y-auto space-y-1">
                          <span class="text-slate-400 block text-[10px]">// Consola de Diagnóstico Meta API:</span>
                          <span id="dev-wa-test-result-text" class="text-slate-400">Listo para enviar prueba...</span>
                        </div>
                      </div>

                      <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                        <span class="font-bold flex items-center gap-1">
                          <i class="fas fa-info-circle"></i> Nota sobre Modo Prueba de Meta:
                        </span>
                        <p class="text-[10px] text-amber-800">
                          Recuerda que en el modo de prueba de Meta, tu número debe estar agregado en el selector "Para:" (To) de la pantalla de Meta for Developers.
                        </p>
                      </div>
                    </div>
                  </div>
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
      document.getElementById('dev-tab-whatsapp')?.addEventListener('click', () => {
        this.activeDevTab = 'whatsapp';
        this.renderDeveloperDashboardView(container);
      });

      // Guardar Configuración de WhatsApp
      document.getElementById('dev-save-wa-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tokenInput = document.getElementById('dev-wa-token');
        const phoneIdInput = document.getElementById('dev-wa-phone-id');
        const wabaIdInput = document.getElementById('dev-wa-waba-id');
        const saveBtn = document.getElementById('dev-save-wa-btn');

        const token = tokenInput?.value?.trim();
        const phoneNumberId = phoneIdInput?.value?.trim();
        const wabaId = wabaIdInput?.value?.trim();

        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Guardando...';
        }

        try {
          const payload = { phoneNumberId, wabaId };
          if (token) payload.token = token;

          await storage.saveWhatsAppSettings(payload);
          this.showToast('¡Credenciales de Meta WhatsApp guardadas con éxito!', 'success');
          this.renderDeveloperDashboardView(container);
        } catch (err) {
          this.showToast(err.message || 'Error guardando credenciales.', 'error');
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-save mr-1"></i> Guardar Credenciales en Base de Datos';
          }
        }
      });

      // Toggle visibilidad del token
      document.getElementById('dev-wa-token-toggle')?.addEventListener('click', () => {
        const tokenInput = document.getElementById('dev-wa-token');
        if (tokenInput) {
          tokenInput.type = tokenInput.type === 'password' ? 'text' : 'password';
        }
      });

      // Enviar WhatsApp de prueba en vivo
      document.getElementById('dev-send-test-wa-btn')?.addEventListener('click', async () => {
        const phoneInput = document.getElementById('dev-test-phone-input');
        const resultText = document.getElementById('dev-wa-test-result-text');
        const testBtn = document.getElementById('dev-send-test-wa-btn');
        const phone = phoneInput?.value?.trim();

        if (!phone) {
          this.showToast('Ingresa un número de teléfono para la prueba.', 'error');
          return;
        }

        if (testBtn) {
          testBtn.disabled = true;
          testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        }
        if (resultText) {
          resultText.className = 'text-amber-400 animate-pulse';
          resultText.textContent = `Enviando mensaje de prueba a ${phone} mediante Meta Cloud API...`;
        }

        try {
          const res = await storage.testWhatsAppNotification(phone);
          if (res.result?.success) {
            if (resultText) {
              resultText.className = 'text-emerald-400 font-bold';
              resultText.textContent = `✅ ÉXITO: Mensaje enviado por ${res.result.provider || 'Meta'} (ID: ${res.result.messageId || res.result.sid || 'OK'})`;
            }
            this.showToast('¡WhatsApp de prueba entregado con éxito!', 'success');
          } else {
            const errDetail = res.result?.error || res.error || res.result?.reason || 'Error desconocido';
            if (resultText) {
              resultText.className = 'text-rose-400';
              resultText.textContent = `❌ FALLO DE META: ${errDetail}`;
            }
            this.showToast('Error al enviar WhatsApp. Revisa la consola abajo.', 'error');
          }
        } catch (e) {
          if (resultText) {
            resultText.className = 'text-rose-400';
            resultText.textContent = `❌ ERROR: ${e.message}`;
          }
          this.showToast('Error de conexión al enviar WhatsApp.', 'error');
        } finally {
          if (testBtn) {
            testBtn.disabled = false;
            testBtn.innerHTML = '<i class="fas fa-play text-[10px]"></i> <span>Enviar Test</span>';
          }
        }
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

      // Cambiar Plan de Suscripción desde el Panel Developer
      document.querySelectorAll('.dev-change-plan-select').forEach(sel => {
        sel.addEventListener('change', async (e) => {
          const bizId = e.target.getAttribute('data-id');
          const bizName = e.target.getAttribute('data-name');
          const newPlan = e.target.value;
          const planNames = {
            basic: 'Plan Básico ($8 • 150 reservas)',
            pro: 'Plan Profesional ($15 • 300 reservas)',
            unlimited: 'Plan Ilimitado ($25 • Reservas Ilimitadas)'
          };

          try {
            e.target.disabled = true;
            await storage.setDeveloperBusinessPlan(bizId, newPlan);
            this.showToast(`¡Plan de "${bizName}" actualizado a ${planNames[newPlan] || newPlan}!`, 'success');
            this.renderDeveloperDashboardView(container);
          } catch (err) {
            this.showToast(err.message || 'Error al actualizar el plan del negocio.', 'error');
            e.target.disabled = false;
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
  renderAuthModal({ mode = 'login', role = 'client', selectedPlanId = 'pro' } = {}) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const currentClient = storage.getClientUser();
    const categories = storage.getCategories().filter(c => c.id !== 'all');
    const plans = storage.getSubscriptionPlans();

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl ${role === 'business' && mode === 'register' ? 'max-w-xl' : 'max-w-md'} w-full overflow-hidden border border-slate-200 my-0 sm:my-8 max-h-[92vh] flex flex-col mobile-bottom-sheet">
          
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
            <button id="close-auth-modal-btn" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer">
              <i class="fas fa-times text-sm"></i>
            </button>
          </div>

          <!-- Pestañas de Modo (Iniciar Sesión / Registrarse) y Selección de Rol (Cliente / Negocio) -->
          <div class="p-5 pb-0 shrink-0 space-y-3 bg-slate-50 border-b border-slate-200/80">
            <!-- Tabs Modo: Iniciar Sesión / Registrarse -->
            <div class="flex p-1 bg-slate-200/80 rounded-2xl">
              <button id="tab-mode-login" class="flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}">
                <i class="fas fa-sign-in-alt text-xs ${mode === 'login' ? 'text-blue-600' : ''}"></i> Iniciar Sesión
              </button>
              <button id="tab-mode-register" class="flex-1 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${mode === 'register' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}">
                <i class="fas fa-user-plus text-xs ${mode === 'register' ? 'text-blue-600' : ''}"></i> Registrarse
              </button>
            </div>

            <!-- Tabs Rol: Cliente / Negocio -->
            <div class="flex gap-2 pb-3">
              <button id="tab-role-client" class="flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${role === 'client' ? 'bg-blue-600 border-blue-600 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}">
                <i class="fas fa-user text-xs"></i> Soy Cliente
              </button>
              <button id="tab-role-business" class="flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${role === 'business' ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}">
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

                <button type="submit" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
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

                <button type="submit" class="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <i class="fas fa-sign-in-alt"></i>
                  <span>Ingresar al Panel de Negocio</span>
                </button>
              </form>

              <!-- Acceso Rápido Demo -->
              <div class="pt-4 border-t border-slate-100">
                <span class="text-[11px] font-bold text-slate-400 uppercase block mb-2">⚡ Acceso Rápido a Comercios de Muestra (1-Clic)</span>
                <div class="grid grid-cols-2 gap-2">
                  <button type="button" class="quick-demo-btn p-2 text-left rounded-xl border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-xs text-slate-700 transition-colors cursor-pointer" data-email="barberia@demo.cr" data-pass="123">
                    <span class="font-bold block truncate">Barbería Vintage</span>
                    <span class="text-[10px] text-slate-400">barberia@demo.cr</span>
                  </button>
                  <button type="button" class="quick-demo-btn p-2 text-left rounded-xl border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-xs text-slate-700 transition-colors cursor-pointer" data-email="dental@demo.cr" data-pass="123">
                    <span class="font-bold block truncate">Clínica Dental</span>
                    <span class="text-[10px] text-slate-400">dental@demo.cr</span>
                  </button>
                  <button type="button" class="quick-demo-btn p-2 text-left rounded-xl border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-xs text-slate-700 transition-colors cursor-pointer" data-email="spa@demo.cr" data-pass="123">
                    <span class="font-bold block truncate">Serenity Spa</span>
                    <span class="text-[10px] text-slate-400">spa@demo.cr</span>
                  </button>
                  <button type="button" class="quick-demo-btn p-2 text-left rounded-xl border border-slate-200 hover:bg-indigo-50 hover:border-indigo-300 text-xs text-slate-700 transition-colors cursor-pointer" data-email="taller@demo.cr" data-pass="123">
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

                <!-- Mensaje Inline de Validación de Contraseñas -->
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

                <button type="submit" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer">
                  <i class="fas fa-user-plus"></i>
                  <span>Crear Cuenta de Cliente</span>
                </button>
              </form>
            ` : ''}

            ${mode === 'register' && role === 'business' ? `
              <!-- FORM 4: REGISTRO NUEVO NEGOCIO -->
              <form id="auth-biz-reg-form" class="space-y-4 text-xs sm:text-sm">
                
                <!-- 1. SELECCIÓN DE PLAN DE SUSCRIPCIÓN -->
                <div class="p-4 bg-slate-900 text-white rounded-2xl space-y-3 border border-indigo-500/30 shadow-md">
                  <div class="flex items-center justify-between">
                    <span class="font-black text-amber-400 block text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <i class="fas fa-tags"></i> Elige tu Plan de Suscripción *
                    </span>
                    <span class="text-[10px] text-slate-300 font-medium">Cambia o cancela cuando quieras</span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <!-- Plan Básico -->
                    <label class="biz-plan-card-label relative p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${selectedPlanId === 'basic' ? 'bg-indigo-950 border-blue-400 ring-2 ring-blue-400/30' : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'}">
                      <input type="radio" name="new-biz-plan" value="basic" ${selectedPlanId === 'basic' ? 'checked' : ''} class="sr-only">
                      <div>
                        <div class="flex justify-between items-start mb-1">
                          <span class="font-black text-xs text-white">Básico</span>
                          <span class="text-[9px] font-bold text-blue-300 bg-blue-900/80 px-1.5 py-0.5 rounded">150 citas</span>
                        </div>
                        <div class="text-base font-black text-white">$6 <span class="text-[10px] font-normal text-slate-400">/mes</span></div>
                        <p class="text-[10px] text-slate-400 mt-0.5">~₡3,200 CRC / mes</p>
                      </div>
                      <div class="text-[10px] text-slate-300 mt-2 pt-1 border-t border-slate-700/80 flex items-center gap-1">
                        <i class="fas fa-check text-emerald-400 text-[9px]"></i> 150 reservas/mes
                      </div>
                    </label>

                    <!-- Plan Profesional -->
                    <label class="biz-plan-card-label relative p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${selectedPlanId === 'pro' ? 'bg-indigo-950 border-amber-400 ring-2 ring-amber-400/30' : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'}">
                      <span class="absolute -top-2 right-2 px-1.5 py-0.2 bg-amber-400 text-slate-950 text-[9px] font-black rounded-full shadow-xs uppercase">Popular</span>
                      <input type="radio" name="new-biz-plan" value="pro" ${selectedPlanId === 'pro' ? 'checked' : ''} class="sr-only">
                      <div>
                        <div class="flex justify-between items-start mb-1">
                          <span class="font-black text-xs text-amber-300">Profesional</span>
                          <span class="text-[9px] font-bold text-amber-950 bg-amber-400 px-1.5 py-0.5 rounded">300 citas</span>
                        </div>
                        <div class="text-base font-black text-amber-300">$15 <span class="text-[10px] font-normal text-slate-400">/mes</span></div>
                        <p class="text-[10px] text-slate-400 mt-0.5">~₡7,900 CRC / mes</p>
                      </div>
                      <div class="text-[10px] text-slate-300 mt-2 pt-1 border-t border-slate-700/80 flex items-center gap-1">
                        <i class="fas fa-check text-amber-400 text-[9px]"></i> 300 reservas/mes
                      </div>
                    </label>

                    <!-- Plan Ilimitado -->
                    <label class="biz-plan-card-label relative p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${selectedPlanId === 'unlimited' ? 'bg-indigo-950 border-purple-400 ring-2 ring-purple-400/30' : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'}">
                      <input type="radio" name="new-biz-plan" value="unlimited" ${selectedPlanId === 'unlimited' ? 'checked' : ''} class="sr-only">
                      <div>
                        <div class="flex justify-between items-start mb-1">
                          <span class="font-black text-xs text-purple-300">Ilimitado</span>
                          <span class="text-[9px] font-bold text-purple-300 bg-purple-900/80 px-1.5 py-0.5 rounded">Ilimitado</span>
                        </div>
                        <div class="text-base font-black text-purple-300">$25 <span class="text-[10px] font-normal text-slate-400">/mes</span></div>
                        <p class="text-[10px] text-slate-400 mt-0.5">~₡13,000 CRC / mes</p>
                      </div>
                      <div class="text-[10px] text-slate-300 mt-2 pt-1 border-t border-slate-700/80 flex items-center gap-1">
                        <i class="fas fa-infinity text-purple-400 text-[9px]"></i> Citas sin límite
                      </div>
                    </label>
                  </div>
                </div>

                <!-- 2. Cuenta de Usuario / Credenciales -->
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
                      <input type="password" id="reg-biz-password" required minlength="6" placeholder="Mínimo 6 caracteres" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all">
                    </div>
                    <div>
                      <label class="block font-bold text-slate-700 mb-1">Confirmar Contraseña *</label>
                      <input type="password" id="reg-biz-password-confirm" required minlength="6" placeholder="Repite tu contraseña" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all">
                    </div>
                  </div>

                  <!-- Mensaje Inline de Validación de Contraseñas -->
                  <div id="biz-reg-inline-error" class="hidden p-3 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"></div>
                </div>

                <!-- 3. Datos Comerciales -->
                <div>
                  <label class="block font-bold text-slate-700 mb-1">Nombre Comercial del Negocio *</label>
                  <input type="text" id="new-biz-name" required placeholder="Ej. Barbería Costa Rica, Clínica Dental..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Categoría del Negocio *</label>
                    <select id="new-biz-cat" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none">
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

                <!-- Redes Sociales y Enlaces Web (Opcional) -->
                <div class="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-slate-800 block text-xs uppercase tracking-wider">
                      <i class="fas fa-share-alt mr-1 text-blue-600"></i> Redes Sociales y Web (Opcional)
                    </span>
                    <span class="text-[10px] text-slate-400 font-medium">Se mostrarán en tu perfil</span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-pink-600 text-xs">
                        <i class="fab fa-instagram"></i>
                      </div>
                      <input type="text" id="new-biz-instagram" placeholder="Instagram (ej. @minegocio)" class="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-pink-400 focus:outline-none">
                    </div>

                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-blue-600 text-xs">
                        <i class="fab fa-facebook"></i>
                      </div>
                      <input type="text" id="new-biz-facebook" placeholder="Facebook (ej. facebook.com/minegocio)" class="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-400 focus:outline-none">
                    </div>

                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-900 text-xs">
                        <i class="fab fa-tiktok"></i>
                      </div>
                      <input type="text" id="new-biz-tiktok" placeholder="TikTok (ej. @minegocio)" class="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-slate-400 focus:outline-none">
                    </div>

                    <div class="relative">
                      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-emerald-600 text-xs">
                        <i class="fas fa-globe"></i>
                      </div>
                      <input type="text" id="new-biz-website" placeholder="Sitio Web / Menú Digital" class="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none">
                    </div>
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

                <button type="submit" class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/25 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer">
                  <i class="fas fa-check-circle"></i>
                  <span>Crear Cuenta y Registrar Negocio</span>
                </button>
              </form>
            ` : ''}

            <!-- Enlace sutil para Developer -->
            <div class="pt-3 text-center border-t border-slate-100">
              <button type="button" id="modal-dev-link-btn" class="text-[11px] text-slate-400 hover:text-slate-600 font-medium transition-colors cursor-pointer">
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
      this.renderAuthModal({ mode: 'login', role, selectedPlanId });
    });
    document.getElementById('tab-mode-register')?.addEventListener('click', () => {
      this.renderAuthModal({ mode: 'register', role, selectedPlanId });
    });

    // Pestañas de Rol (Cliente / Negocio)
    document.getElementById('tab-role-client')?.addEventListener('click', () => {
      this.renderAuthModal({ mode, role: 'client', selectedPlanId });
    });
    document.getElementById('tab-role-business')?.addEventListener('click', () => {
      this.renderAuthModal({ mode, role: 'business', selectedPlanId });
    });

    // Selector visual de planes
    document.querySelectorAll('.biz-plan-card-label').forEach(label => {
      label.addEventListener('click', () => {
        document.querySelectorAll('.biz-plan-card-label').forEach(l => {
          l.classList.remove('bg-indigo-950', 'border-blue-400', 'border-amber-400', 'border-purple-400', 'ring-2', 'ring-blue-400/30', 'ring-amber-400/30', 'ring-purple-400/30');
          l.classList.add('bg-slate-800/80', 'border-slate-700');
        });
        const radio = label.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          const val = radio.value;
          label.classList.remove('bg-slate-800/80', 'border-slate-700');
          label.classList.add('bg-indigo-950', 'ring-2');
          if (val === 'pro') label.classList.add('border-amber-400', 'ring-amber-400/30');
          else if (val === 'unlimited') label.classList.add('border-purple-400', 'ring-purple-400/30');
          else label.classList.add('border-blue-400', 'ring-blue-400/30');
        }
      });
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
    document.getElementById('auth-client-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifier = document.getElementById('cli-log-identifier').value.trim();
      const password = document.getElementById('cli-log-password').value;
      const errBox = document.getElementById('cli-log-inline-error');

      try {
        if (errBox) errBox.className = 'hidden';
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
        }
      }
    });

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
        }
      }
    });

    // Evento Submit: Login Negocio
    document.getElementById('auth-biz-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('biz-log-email').value;
      const password = document.getElementById('biz-log-password').value;
      const errBox = document.getElementById('biz-log-inline-error');

      try {
        if (errBox) errBox.className = 'hidden';
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
        }
      }
    });

    // Evento Submit: Registro Negocio (Con Selección de Plan)
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
      const instagram = document.getElementById('new-biz-instagram')?.value.trim() || '';
      const facebook = document.getElementById('new-biz-facebook')?.value.trim() || '';
      const tiktok = document.getElementById('new-biz-tiktok')?.value.trim() || '';
      const website = document.getElementById('new-biz-website')?.value.trim() || '';
      const socialLinks = { instagram, facebook, tiktok, website };
      const errBox = document.getElementById('biz-reg-inline-error');

      // Plan de suscripción elegido
      const chosenPlanRadio = document.querySelector('input[name="new-biz-plan"]:checked');
      const chosenPlanId = chosenPlanRadio ? chosenPlanRadio.value : 'basic';
      const planConfig = storage.getPlanById(chosenPlanId);

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
        categoryLabel = catObj ? catObj.name : catSelectVal;
      }

      try {
        await storage.registerBusinessWithUser(ownerName, email, password, {
          name,
          category: finalCategory,
          categoryLabel,
          isCustomCategory,
          plan: planConfig.id,
          planPriceUsd: planConfig.priceUsd,
          monthlyBookingLimit: planConfig.bookingLimit,
          city,
          phone,
          email,
          address,
          description,
          image: image || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80',
          coverImage: coverImage || 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80',
          isDemo: false,
          features: ['Sinpe Móvil', 'Atención Personalizada'],
          socialLinks,
          services: [
            { name: firstSrvName, duration: 30, price: parseFloat(firstSrvPrice) || 10000, description: 'Servicio principal.' }
          ]
        });

        this.showToast(`¡Negocio registrado exitosamente con ${planConfig.name}!`, 'success');
        modalContainer.innerHTML = '';
        this.renderHeader();
        this.navigateTo('owner-dashboard');
      } catch (err) {
        this.showToast(err.message || 'Error al registrar negocio.', 'error');
        if (errBox) {
          errBox.className = 'p-3 bg-rose-50 border border-rose-300 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 animate-fade-in';
          errBox.innerHTML = `<i class="fas fa-exclamation-circle text-rose-600 text-sm flex-shrink-0"></i> <span>${err.message || 'Error al registrar negocio.'}</span>`;
        }
      }
    });
  }

  // ==========================================
  // MODAL DE PLANES DE SUSCRIPCIÓN ($6, $15, $25)
  // ==========================================
  renderPlansModal({ businessId = null, currentPlanId = 'basic' } = {}) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const plans = storage.getSubscriptionPlans();
    const isOwnerContext = Boolean(businessId);

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop animate-fade-in overflow-y-auto">
        <div class="bg-white rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200 my-8 max-h-[92vh] flex flex-col">
          
          <!-- Header -->
          <div class="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 p-6 text-white flex items-center justify-between shrink-0 border-b border-indigo-900/50">
            <div>
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-1.5 border border-amber-400/30">
                <i class="fas fa-crown"></i> Planes de Suscripción para Negocios
              </div>
              <h3 class="text-xl sm:text-2xl font-black">Elige el plan ideal para tu comercio</h3>
              <p class="text-xs text-slate-300 mt-0.5">Comienza a recibir citas en línea y recordatorios automáticos por WhatsApp y correo.</p>
            </div>
            <button id="close-plans-modal-btn" class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer">
              <i class="fas fa-times text-sm"></i>
            </button>
          </div>

          <!-- Body: Grid de los 3 Planes -->
          <div class="p-6 overflow-y-auto flex-1 bg-slate-50">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              ${plans.map(plan => {
                const isCurrent = isOwnerContext && (currentPlanId === plan.id);
                const isPro = plan.id === 'pro';
                const isUnlimited = plan.id === 'unlimited';

                return `
                  <div class="relative bg-white rounded-3xl p-6 border-2 ${isPro ? 'border-amber-400 shadow-xl ring-2 ring-amber-400/20' : isUnlimited ? 'border-purple-300 shadow-md' : 'border-slate-200 shadow-sm'} flex flex-col justify-between transition-all duration-300 hover:-translate-y-1">
                    
                    ${plan.badge ? `
                      <div class="absolute -top-3.5 left-1/2 transform -translate-x-1/2">
                        <span class="px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${isPro ? 'bg-amber-400 text-slate-950' : isUnlimited ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'}">
                          ${plan.badge}
                        </span>
                      </div>
                    ` : ''}

                    <div>
                      <div class="flex items-center justify-between mb-2 mt-1">
                        <h4 class="text-lg font-extrabold text-slate-900">${plan.name}</h4>
                        <span class="w-8 h-8 rounded-xl ${isPro ? 'bg-amber-100 text-amber-700' : isUnlimited ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'} flex items-center justify-center text-sm">
                          <i class="fas ${isUnlimited ? 'fa-infinity' : isPro ? 'fa-star' : 'fa-rocket'}"></i>
                        </span>
                      </div>

                      <p class="text-xs text-slate-500 min-h-[36px]">${plan.tagline}</p>

                      <!-- Precio -->
                      <div class="mt-4 pb-4 border-b border-slate-100">
                        <div class="flex items-baseline gap-1">
                          <span class="text-3xl sm:text-4xl font-black text-slate-900">$${plan.priceUsd}</span>
                          <span class="text-xs text-slate-500 font-semibold">USD / mes</span>
                        </div>
                        <span class="text-xs text-slate-500 block font-medium mt-0.5">
                          ~${this.formatColones(plan.priceCrc)} CRC / mes
                        </span>
                        
                        <!-- Límite de reservas badge -->
                        <div class="mt-3 p-2.5 rounded-xl ${isPro ? 'bg-amber-50 text-amber-900 border border-amber-200' : isUnlimited ? 'bg-purple-50 text-purple-900 border border-purple-200' : 'bg-blue-50 text-blue-900 border border-blue-200'} text-xs font-bold flex items-center justify-center gap-1.5">
                          <i class="fas ${isUnlimited ? 'fa-infinity' : 'fa-calendar-check'}"></i>
                          <span>${plan.bookingLimitLabel}</span>
                        </div>
                      </div>

                      <!-- Lista de Beneficios -->
                      <ul class="mt-4 space-y-2.5 text-xs text-slate-600">
                        ${plan.features.map(f => `
                          <li class="flex items-start gap-2">
                            <i class="fas fa-check-circle text-emerald-500 mt-0.5 text-xs flex-shrink-0"></i>
                            <span>${f}</span>
                          </li>
                        `).join('')}
                      </ul>
                    </div>

                    <!-- Botón de Acción -->
                    <div class="mt-6 pt-4 border-t border-slate-100">
                      ${isCurrent ? `
                        <button disabled class="w-full py-3 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-default">
                          <i class="fas fa-check-circle"></i> Tu Plan Actual
                        </button>
                      ` : `
                        <button 
                          class="select-plan-btn w-full py-3 ${isPro ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black shadow-lg shadow-amber-500/25' : isUnlimited ? 'bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-500/20' : 'bg-slate-900 hover:bg-blue-600 text-white font-bold'} rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                          data-plan-id="${plan.id}"
                        >
                          <span>${isOwnerContext ? 'Cambiar a este Plan' : 'Elegir este Plan'}</span>
                          <i class="fas fa-arrow-right text-xs"></i>
                        </button>
                      `}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Footer Seguro -->
          <div class="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 shrink-0">
            <div class="flex items-center gap-2">
              <i class="fas fa-shield-alt text-emerald-600 text-sm"></i>
              <span>Sin contratos forzosos. Cancela o cambia de plan en cualquier momento.</span>
            </div>
            <span class="font-bold text-slate-700">Aceptamos SINPE Móvil y Tarjetas en Costa Rica 🇨🇷</span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('close-plans-modal-btn')?.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    document.querySelectorAll('.select-plan-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const planId = btn.getAttribute('data-plan-id');
        if (isOwnerContext && businessId) {
          try {
            await storage.updateBusinessPlan(businessId, planId);
            const chosenPlan = storage.getPlanById(planId);
            this.showToast(`¡Plan actualizado a ${chosenPlan.name} ($${chosenPlan.priceUsd}/mes)!`, 'success');
            modalContainer.innerHTML = '';
            this.renderCurrentView();
          } catch (err) {
            this.showToast(err.message || 'Error al actualizar plan.', 'error');
          }
        } else {
          modalContainer.innerHTML = '';
          this.renderAuthModal({ mode: 'register', role: 'business', selectedPlanId: planId });
        }
      });
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
  window.__reservasCRApp = app;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
