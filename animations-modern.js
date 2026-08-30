/**
 * SENAI - Animações e Microinterações Premium
 * UI/UX Moderno com Efeitos Visuais Avançados
 */

// ========================================
// UTILITÁRIOS DE ANIMAÇÃO
// ========================================

// Intersection Observer para animações ao scroll
const setupScrollAnimations = () => {
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        
        // Adiciona classes de animação baseadas em data-attributes
        const animationType = entry.target.dataset.animation;
        if (animationType) {
          entry.target.classList.add(`animate-${animationType}`);
        }
        
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Seleciona todos os elementos com data-animation
  document.querySelectorAll('[data-animation]').forEach(el => {
    observer.observe(el);
  });
};

// ========================================
// EFEITO PARALLAX SUAVE
// ========================================

const setupParallax = () => {
  const parallaxElements = document.querySelectorAll('[data-parallax]');
  
  if (parallaxElements.length === 0) return;
  
  let ticking = false;
  
  const updateParallax = () => {
    const scrollY = window.scrollY;
    
    parallaxElements.forEach(el => {
      const speed = el.dataset.parallaxSpeed || 0.5;
      const offset = scrollY * speed;
      el.style.transform = `translateY(${offset}px)`;
    });
    
    ticking = false;
  };
  
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateParallax);
      ticking = true;
    }
  });
};

// ========================================
// EFEITO TILT 3D EM CARDS
// ========================================

const setupTiltEffect = () => {
  const tiltCards = document.querySelectorAll('[data-tilt]');
  
  tiltCards.forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (y - centerY) / 10;
      const rotateY = (centerX - x) / 10;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
      card.style.transition = 'transform 0.1s ease';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
      card.style.transition = 'transform 0.3s ease';
    });
  });
};

// ========================================
// CONTAGEM ANIMADA DE NÚMEROS
// ========================================

const animateCounter = (element, target, duration = 2000, suffix = '') => {
  const start = 0;
  const increment = target / (duration / 16);
  let current = start;
  
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    element.textContent = Math.floor(current).toLocaleString('pt-BR') + suffix;
  }, 16);
};

const setupCounters = () => {
  const counterElements = document.querySelectorAll('[data-counter]');
  
  if (counterElements.length === 0) return;
  
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.5
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;
        const target = parseInt(element.dataset.counter);
        const suffix = element.dataset.suffix || '';
        const duration = parseInt(element.dataset.duration) || 2000;
        
        animateCounter(element, target, duration, suffix);
        observer.unobserve(element);
      }
    });
  }, observerOptions);
  
  counterElements.forEach(el => observer.observe(el));
};

// ========================================
// EFEITO RIPPLE EM BOTÕES
// ========================================

const setupRippleEffect = () => {
  const buttons = document.querySelectorAll('.primary-btn, .ghost-btn, .btn-confirm');
  
  buttons.forEach(button => {
    button.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;
      
      this.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  });
};

// Adiciona estilos para o ripple
const addRippleStyles = () => {
  const style = document.createElement('style');
  style.textContent = `
    .primary-btn, .ghost-btn, .btn-confirm {
      position: relative;
      overflow: hidden;
    }
    
    .ripple {
      position: absolute;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.4);
      transform: scale(0);
      animation: rippleAnimation 0.6s linear;
      pointer-events: none;
    }
    
    @keyframes rippleAnimation {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
};

// ========================================
// EFEITO DIGITAR TEXTO
// ========================================

const typeWriter = (element, text, speed = 50) => {
  let i = 0;
  element.textContent = '';
  
  const type = () => {
    if (i < text.length) {
      element.textContent += text.charAt(i);
      i++;
      setTimeout(type, speed);
    }
  };
  
  type();
};

const setupTypewriters = () => {
  const typeElements = document.querySelectorAll('[data-type]');
  
  if (typeElements.length === 0) return;
  
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.5
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const element = entry.target;
        const text = element.dataset.type;
        const speed = parseInt(element.dataset.speed) || 50;
        
        typeWriter(element, text, speed);
        observer.unobserve(element);
      }
    });
  }, observerOptions);
  
  typeElements.forEach(el => observer.observe(el));
};

// ========================================
// MENU MOBILE COM ANIMAÇÃO
// ========================================

const setupMobileMenu = () => {
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  
  if (!menuToggle || !mobileMenu) return;
  
  menuToggle.addEventListener('click', () => {
    mobileMenu.classList.toggle('active');
    menuToggle.classList.toggle('active');
    document.body.classList.toggle('menu-open');
  });
};

// ========================================
// MODAL COM ANIMAÇÕES
// ========================================

const setupModalAnimations = () => {
  const modals = document.querySelectorAll('.modal-overlay');
  
  modals.forEach(modal => {
    // Fecha ao clicar fora
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
    
    // Fecha com ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('visible')) {
        closeModal(modal);
      }
    });
  });
};

const openModal = (modalId) => {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';
    
    // Foca no primeiro input
    const firstInput = modal.querySelector('input');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }
};

const closeModal = (modal) => {
  if (modal) {
    modal.classList.remove('visible');
    document.body.style.overflow = '';
  }
};

// ========================================
// LOADING SCREEN ANIMADA
// ========================================

const setupLoadingScreen = () => {
  const loader = document.querySelector('[data-loader]');
  
  if (!loader) return;
  
  window.addEventListener('load', () => {
    loader.classList.add('loaded');
    setTimeout(() => {
      loader.remove();
    }, 500);
  });
};

// ========================================
// TOOLTIP CUSTOMIZADO
// ========================================

const setupTooltips = () => {
  const tooltipElements = document.querySelectorAll('[data-tooltip]');
  
  tooltipElements.forEach(el => {
    el.addEventListener('mouseenter', (e) => {
      const tooltip = document.createElement('div');
      tooltip.className = 'custom-tooltip';
      tooltip.textContent = el.dataset.tooltip;
      tooltip.style.position = 'fixed';
      tooltip.style.background = 'rgba(15, 23, 42, 0.98)';
      tooltip.style.color = '#f8fafc';
      tooltip.style.padding = '8px 12px';
      tooltip.style.borderRadius = '8px';
      tooltip.style.fontSize = '12px';
      tooltip.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      tooltip.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)';
      tooltip.style.zIndex = '10000';
      tooltip.style.pointerEvents = 'none';
      tooltip.style.backdropFilter = 'blur(8px)';
      
      document.body.appendChild(tooltip);
      
      const rect = el.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      
      tooltip.style.left = `${rect.left + (rect.width - tooltipRect.width) / 2}px`;
      tooltip.style.top = `${rect.top - tooltipRect.height - 8}px`;
      
      el._tooltip = tooltip;
    });
    
    el.addEventListener('mouseleave', () => {
      if (el._tooltip) {
        el._tooltip.remove();
        el._tooltip = null;
      }
    });
  });
};

// ========================================
// SCROLL PROGRESS BAR
// ========================================

const setupScrollProgress = () => {
  const progressBar = document.querySelector('[data-scroll-progress]');
  
  if (!progressBar) return;
  
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = (scrollTop / docHeight) * 100;
    
    progressBar.style.width = `${scrollPercent}%`;
  });
};

// ========================================
// REVEAL ON SCROLL
// ========================================

const setupRevealOnScroll = () => {
  const revealElements = document.querySelectorAll('.reveal-on-scroll');
  
  if (revealElements.length === 0) return;
  
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -100px 0px',
    threshold: 0.1
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  revealElements.forEach(el => observer.observe(el));
};

// ========================================
// MAGNETIC BUTTONS
// ========================================

const setupMagneticButtons = () => {
  const magneticBtns = document.querySelectorAll('[data-magnetic]');
  
  magneticBtns.forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
    });
    
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translate(0, 0)';
    });
  });
};

// ========================================
// INICIALIZAÇÃO GERAL
// ========================================

const initAllAnimations = () => {
  // Adiciona estilos de ripple
  addRippleStyles();
  
  // Setup de todas as animações
  setupScrollAnimations();
  setupParallax();
  setupTiltEffect();
  setupCounters();
  setupRippleEffect();
  setupTypewriters();
  setupMobileMenu();
  setupModalAnimations();
  setupLoadingScreen();
  setupTooltips();
  setupScrollProgress();
  setupRevealOnScroll();
  setupMagneticButtons();
  
  console.log('✨ SENAI UI/UX Premium initialized');
};

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllAnimations);
} else {
  initAllAnimations();
}

// Exporta funções para uso global
window.SENAIAnimations = {
  openModal,
  closeModal,
  animateCounter,
  typeWriter,
  initAllAnimations
};
