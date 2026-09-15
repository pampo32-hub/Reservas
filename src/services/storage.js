// Servicio de almacenamiento y lógica de negocio (Local Storage + Cálculos de Horarios)
import { INITIAL_BUSINESSES, INITIAL_APPOINTMENTS, INITIAL_CATEGORIES } from '../data/initialData.js';

const STORAGE_KEYS = {
  BUSINESSES: 'directorio_businesses_v1',
  APPOINTMENTS: 'directorio_appointments_v1',
  ACTIVE_BUSINESS_ID: 'directorio_active_biz_id'
};

class StorageService {
  constructor() {
    this.init();
  }

  init() {
    if (!localStorage.getItem(STORAGE_KEYS.BUSINESSES)) {
      localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(INITIAL_BUSINESSES));
    }
    if (!localStorage.getItem(STORAGE_KEYS.APPOINTMENTS)) {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(INITIAL_APPOINTMENTS));
    }
    if (!localStorage.getItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID)) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID, 'biz-1');
    }
  }

  // --- CATEGORÍAS ---
  getCategories() {
    return INITIAL_CATEGORIES;
  }

  // --- NEGOCIOS ---
  getBusinesses() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BUSINESSES);
      return data ? JSON.parse(data) : INITIAL_BUSINESSES;
    } catch (e) {
      console.error('Error leyendo negocios:', e);
      return INITIAL_BUSINESSES;
    }
  }

  getBusinessById(id) {
    const businesses = this.getBusinesses();
    return businesses.find(b => b.id === id) || null;
  }

  saveBusiness(businessData) {
    const businesses = this.getBusinesses();
    const existingIndex = businesses.findIndex(b => b.id === businessData.id);

    if (existingIndex >= 0) {
      businesses[existingIndex] = { ...businesses[existingIndex], ...businessData };
    } else {
      const newBusiness = {
        ...businessData,
        id: businessData.id || `biz-${Date.now()}`,
        rating: businessData.rating || 5.0,
        reviewsCount: businessData.reviewsCount || 0,
        services: businessData.services || [],
        schedule: businessData.schedule || {
          days: [1, 2, 3, 4, 5, 6],
          openTime: '09:00',
          closeTime: '19:00',
          breakStart: '14:00',
          breakEnd: '15:00',
          slotDuration: 30
        }
      };
      businesses.push(newBusiness);
    }

    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    return businessData.id;
  }

  getActiveBusinessId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID) || 'biz-1';
  }

  setActiveBusinessId(id) {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID, id);
  }

  // --- SERVICIOS ---
  addService(businessId, serviceData) {
    const businesses = this.getBusinesses();
    const business = businesses.find(b => b.id === businessId);
    if (!business) return null;

    const newService = {
      id: `srv-${Date.now()}`,
      name: serviceData.name,
      duration: parseInt(serviceData.duration, 10) || 30,
      price: parseFloat(serviceData.price) || 0,
      description: serviceData.description || ''
    };

    business.services.push(newService);
    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    return newService;
  }

  updateService(businessId, serviceId, serviceData) {
    const businesses = this.getBusinesses();
    const business = businesses.find(b => b.id === businessId);
    if (!business) return false;

    const serviceIndex = business.services.findIndex(s => s.id === serviceId);
    if (serviceIndex === -1) return false;

    business.services[serviceIndex] = {
      ...business.services[serviceIndex],
      ...serviceData,
      duration: parseInt(serviceData.duration, 10) || business.services[serviceIndex].duration,
      price: parseFloat(serviceData.price) || business.services[serviceIndex].price
    };

    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    return true;
  }

  deleteService(businessId, serviceId) {
    const businesses = this.getBusinesses();
    const business = businesses.find(b => b.id === businessId);
    if (!business) return false;

    business.services = business.services.filter(s => s.id !== serviceId);
    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(businesses));
    return true;
  }

  // --- RESERVAS / CITAS ---
  getAppointments() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
      return data ? JSON.parse(data) : INITIAL_APPOINTMENTS;
    } catch (e) {
      console.error('Error leyendo reservas:', e);
      return INITIAL_APPOINTMENTS;
    }
  }

  getAppointmentsByBusiness(businessId) {
    const all = this.getAppointments();
    return all.filter(a => a.businessId === businessId);
  }

  createAppointment(appointmentData) {
    const appointments = this.getAppointments();
    const newAppointment = {
      id: `apt-${Date.now().toString().slice(-6)}`,
      ...appointmentData,
      status: appointmentData.status || 'confirmed',
      createdAt: new Date().toISOString()
    };

    appointments.unshift(newAppointment);
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
    return newAppointment;
  }

  updateAppointmentStatus(appointmentId, newStatus) {
    const appointments = this.getAppointments();
    const appt = appointments.find(a => a.id === appointmentId);
    if (!appt) return false;

    appt.status = newStatus;
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
    return true;
  }

  deleteAppointment(appointmentId) {
    let appointments = this.getAppointments();
    appointments = appointments.filter(a => a.id !== appointmentId);
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(appointments));
    return true;
  }

  // --- CÁLCULO DE DISPONIBILIDAD EN TIEMPO REAL ---
  /**
   * Calcula los intervalos de tiempo disponibles para un negocio en una fecha determinada y duración de servicio
   */
  getAvailableSlots(businessId, dateString, serviceDurationMinutes = 30) {
    const business = this.getBusinessById(businessId);
    if (!business || !business.schedule) return [];

    // Parsear fecha y obtener día de la semana (0: Domingo, 1: Lunes, etc.)
    // Usamos split para evitar desfase de zona horaria UTC
    const [year, month, day] = dateString.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();

    // 1. Validar si el negocio abre este día
    if (!business.schedule.days.includes(dayOfWeek)) {
      return { isClosed: true, reason: 'El negocio no labora en este día de la semana.', slots: [] };
    }

    // Convertir horas a minutos desde medianoche para cálculos precisos
    const timeToMinutes = (timeStr) => {
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const minutesToTime = (totalMinutes) => {
      const h = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
      const m = (totalMinutes % 60).toString().padStart(2, '0');
      return `${h}:${m}`;
    };

    const openMin = timeToMinutes(business.schedule.openTime || '09:00');
    const closeMin = timeToMinutes(business.schedule.closeTime || '18:00');
    const breakStartMin = business.schedule.breakStart ? timeToMinutes(business.schedule.breakStart) : -1;
    const breakEndMin = business.schedule.breakEnd ? timeToMinutes(business.schedule.breakEnd) : -1;
    const slotStep = business.schedule.slotDuration || 30;
    const serviceDur = parseInt(serviceDurationMinutes, 10) || 30;

    // 2. Obtener reservas activas en esa fecha
    const existingAppointments = this.getAppointmentsByBusiness(businessId).filter(
      appt => appt.date === dateString && appt.status !== 'cancelled'
    );

    // Mapear reservas existentes a rangos de minutos [inicio, fin]
    const bookedRanges = existingAppointments.map(appt => {
      const start = timeToMinutes(appt.time);
      const duration = appt.serviceDuration || 30;
      return { start, end: start + duration };
    });

    const availableSlots = [];

    // 3. Iterar por el horario de apertura
    for (let current = openMin; current + serviceDur <= closeMin; current += slotStep) {
      const slotEnd = current + serviceDur;

      // Verificar si choca con horario de receso/almuerzo
      if (breakStartMin !== -1 && breakEndMin !== -1) {
        // Si el slot inicia o termina dentro del descanso, o envuelve el descanso
        const overlapsBreak = (current < breakEndMin && slotEnd > breakStartMin);
        if (overlapsBreak) {
          continue;
        }
      }

      // Verificar si choca con alguna reserva ya existente
      const hasConflict = bookedRanges.some(booked => {
        return (current < booked.end && slotEnd > booked.start);
      });

      if (!hasConflict) {
        availableSlots.push(minutesToTime(current));
      }
    }

    return {
      isClosed: false,
      slots: availableSlots
    };
  }

  // --- RESTABLECER DATOS DE PRUEBA ---
  resetToDefaults() {
    localStorage.setItem(STORAGE_KEYS.BUSINESSES, JSON.stringify(INITIAL_BUSINESSES));
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(INITIAL_APPOINTMENTS));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_BUSINESS_ID, 'biz-1');
  }
}

export const storage = new StorageService();

