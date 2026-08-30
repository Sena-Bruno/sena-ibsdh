/**
 * SENAI - Ultra Premium Effects & Interactions
 * Efeitos Visuais Avançados, Partículas e Microinterações
 */

class UltraEffects {
  constructor() {
    this.particles = [];
    this.tiltElements = [];
    this.observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
    
    this.init();
  }
  
  init() {
    this.createParticles();
    this.initTiltEffect();
    this.initScrollAnimations();
    this.initRippleEffect();
    this.initCounterAnimation();
    this.initTypewriterEffect();
    this.initParallaxGlow();
    this.initMagneticButtons();
  }
  
  // ========================================
  // SISTEMA DE PARTÍCULAS
  // ========================================
  createParticles(count = 30) {
    const container = document.createElement('div');
    container.className = 'particle-container';
    document.body.appendChild(container);
    
    for (let i = 0; i < count; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      
      // Randomização avançada
      const size = Math.random() * 4 + 2;
      const left = Math.random() * 100;
      const delay = Math.random() * 15;
      const duration = Math.random() * 10 + 10;
      const opacity = Math.random() * 0.3 + 0.1;
      
      // Cores variadas
      const colors = ['#00f5ff', '#bd00ff', '#ff0080', '#00ff88', '#667eea'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      particle.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${left}%;
        animation-delay: ${delay}s;
        animation-duration: ${duration}s;
        opacity: ${opacity};
        background: ${color};
        box-shadow: 0 0 ${size * 3}px ${color};
      `;
      
      container.appendChild(particle);
      this.particles.push(particle);
    }
  }
  
  // ========================================
  // EFEITO TILT 3D
  // ========================================
  initTiltEffect() {
    const tiltElements = document.querySelectorAll('.card, .status-card, .score-card');
    
    tiltElements.forEach(el => {
      el.addEventListener('mousemove', (e) => {
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;
        
        el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
        el.style.transition = 'transform 0.1s ease';
      });
      
      el.addEventListener('mouseleave', () => {
        el.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale(1)';
        el.style.transition = 'transform 0.3s ease';
      });
    });
  }
  
  // ========================================
  // ANIMAÇÕES AO SCROLL
  // ========================================
  initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
          
          // Adiciona delay baseado no índice
          const index = Array.from(entry.target.parentNode.children).indexOf(entry.target);
          entry.target.style.animationDelay = `${index * 0.1}s`;
        }
      });
    }, this.observerOptions);
    
    document.querySelectorAll('.card, .status-card, .result-block').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(el);
    });
  }
  
  // ========================================
  // EFEITO RIPPLE NOS BOTÕES
  // ========================================
  initRippleEffect() {
    document.querySelectorAll('.primary-btn, .ghost-btn, .mic-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        const rect = this.getBoundingClientRect();
        const ripple = document.createElement('span');
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
          position: absolute;
          width: ${size}px;
          height: ${size}px;
          left: ${x}px;
          top: ${y}px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.3);
          transform: scale(0);
          animation: rippleEffect 0.6s ease-out;
          pointer-events: none;
        `;
        
        this.style.position = 'relative';
        this.style.overflow = 'hidden';
        this.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
      });
    });
    
    // Adiciona keyframes do ripple
    if (!document.getElementById('ripple-styles')) {
      const style = document.createElement('style');
      style.id = 'ripple-styles';
      style.textContent = `
        @keyframes rippleEffect {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  // ========================================
  // ANIMAÇÃO DE CONTAGEM
  // ========================================
  initCounterAnimation() {
    const counters = document.querySelectorAll('.score-number, .status-value');
    
    const animateCounter = (counter) => {
      const target = parseInt(counter.textContent.replace(/\D/g, ''));
      if (isNaN(target)) return;
      
      let current = 0;
      const increment = target / 50;
      const duration = 2000;
      const stepTime = duration / 50;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          counter.textContent = target + (counter.textContent.includes('%') ? '%' : '');
          clearInterval(timer);
        } else {
          counter.textContent = Math.floor(current) + (counter.textContent.includes('%') ? '%' : '');
        }
      }, stepTime);
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    
    counters.forEach(counter => observer.observe(counter));
  }
  
  // ========================================
  // EFEITO TYPEWRITER
  // ========================================
  initTypewriterEffect() {
    const elements = document.querySelectorAll('.hero p, .processing-copy');
    
    elements.forEach(el => {
      const text = el.textContent;
      el.textContent = '';
      el.style.borderRight = '2px solid var(--neon-cyan)';
      
      let i = 0;
      const type = () => {
        if (i < text.length) {
          el.textContent += text.charAt(i);
          i++;
          setTimeout(type, 30);
        } else {
          el.style.borderRight = 'none';
        }
      };
      
      // Inicia quando visível
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          setTimeout(type, 500);
          observer.unobserve(el);
        }
      }, { threshold: 0.5 });
      
      observer.observe(el);
    });
  }
  
  // ========================================
  // PARALLAX GLOW
  // ========================================
  initParallaxGlow() {
    const hero = document.querySelector('.hero');
    if (!hero) return;
    
    document.addEventListener('mousemove', (e) => {
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      
      hero.style.backgroundPosition = `${50 + x * 10}% ${50 + y * 10}%`;
    });
  }
  
  // ========================================
  // BOTÕES MAGNÉTICOS
  // ========================================
  initMagneticButtons() {
    const buttons = document.querySelectorAll('.primary-btn, .ghost-btn');
    
    buttons.forEach(btn => {
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
  }
  
  // ========================================
  // SMOOTH REVEAL
  // ========================================
  static reveal(element, delay = 0) {
    setTimeout(() => {
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    }, delay);
  }
  
  // ========================================
  // LOADING PROGRESS
  // ========================================
  static initLoadingProgress() {
    const loadingScreen = document.querySelector('.loading-screen');
    if (!loadingScreen) return;
    
    let progress = 0;
    const progressBar = loadingScreen.querySelector('.progress-bar');
    
    const interval = setInterval(() => {
      progress += Math.random() * 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        setTimeout(() => {
          loadingScreen.style.opacity = '0';
          loadingScreen.style.pointerEvents = 'none';
          setTimeout(() => loadingScreen.remove(), 500);
        }, 500);
      }
      
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }
    }, 100);
  }
}

// ========================================
// INICIALIZAÇÃO
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  // Inicializa efeitos
  window.ultraEffects = new UltraEffects();
  
  // Adiciona classe de loaded ao body
  document.body.classList.add('loaded');
  
  // Console branding
  console.log('%c🚀 SENAI Ultra Premium', 'font-size: 20px; font-weight: bold; color: #00f5ff; text-shadow: 0 0 20px rgba(0, 245, 255, 0.5);');
  console.log('%cDesign System Avançado Carregado', 'font-size: 12px; color: #bd00ff;');
});

// ========================================
// UTILITÁRIOS GLOBAIS
// ========================================
window.UltraUI = {
  // Toast Notification
  toast: (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    const colors = {
      info: 'var(--neon-cyan)',
      success: 'var(--accent-success)',
      error: 'var(--accent-danger)',
      warning: 'var(--accent-gold)'
    };
    
    toast.style.cssText = `
      position: fixed;
      bottom: 30px;
      right: 30px;
      padding: 16px 24px;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(20px);
      border: 1px solid ${colors[type] || colors.info};
      border-left: 4px solid ${colors[type] || colors.info};
      border-radius: 12px;
      color: var(--text-primary);
      font-weight: 600;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
      z-index: 10000;
      animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },
  
  // Confirmação Modal
  confirm: (message) => {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay visible';
      modal.innerHTML = `
        <div class="modal-card">
          <h2 style="margin-bottom: 16px;">Confirmação</h2>
          <p style="margin-bottom: 24px; color: var(--text-secondary);">${message}</p>
          <div style="display: flex; gap: 12px;">
            <button class="btn-cancel" style="flex: 1; padding: 14px; border-radius: 10px; border: 1px solid var(--border-medium); background: rgba(255,255,255,0.05); color: var(--text-primary); cursor: pointer; font-weight: 700;">Cancelar</button>
            <button class="btn-confirm-action" style="flex: 1; padding: 14px; border-radius: 10px; border: none; background: linear-gradient(135deg, var(--neon-cyan), var(--accent-blue)); color: var(--text-inverse); cursor: pointer; font-weight: 900;">Confirmar</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      modal.querySelector('.btn-cancel').onclick = () => {
        modal.classList.remove('visible');
        setTimeout(() => modal.remove(), 300);
        resolve(false);
      };
      
      modal.querySelector('.btn-confirm-action').onclick = () => {
        modal.classList.remove('visible');
        setTimeout(() => modal.remove(), 300);
        resolve(true);
      };
    });
  },
  
  // Loading Overlay
  showLoading: (message = 'Carregando...') => {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
      <div style="display: grid; place-items: center; min-height: 100vh; background: rgba(0, 2, 16, 0.9); backdrop-filter: blur(20px); z-index: 9999;">
        <div style="text-align: center;">
          <div class="orbital" style="width: 120px; height: 120px; margin: 0 auto 24px;">
            <div class="ring"></div>
            <div class="ring"></div>
            <div class="ring"></div>
            <div class="core"></div>
          </div>
          <p style="color: var(--text-primary); font-weight: 700; font-size: 16px;">${message}</p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  },
  
  hideLoading: (overlay) => {
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s ease';
      setTimeout(() => overlay.remove(), 300);
    }
  }
};

// Adiciona animação de saída para toast
if (!document.getElementById('toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    @keyframes slideOutRight {
      from {
        opacity: 1;
        transform: translateX(0);
      }
      to {
        opacity: 0;
        transform: translateX(100%);
      }
    }
  `;
  document.head.appendChild(style);
}
