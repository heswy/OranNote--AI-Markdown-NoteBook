// 平滑滚动到指定区域
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// 显示体验选择浮窗
function showExperienceModal(event) {
    event.preventDefault();
    const modal = document.getElementById('experienceModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// 隐藏体验选择浮窗
function hideExperienceModal() {
    const modal = document.getElementById('experienceModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// 点击体验浮窗外部关闭
function handleExperienceModalClick(e) {
    const modal = document.getElementById('experienceModal');
    if (e.target === modal) {
        hideExperienceModal();
    }
}

// 显示下载模态框
function showDownloadModal() {
    const modal = document.getElementById('downloadModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// 隐藏下载模态框
function hideDownloadModal() {
    const modal = document.getElementById('downloadModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// 点击模态框外部关闭
function handleModalClick(e) {
    const modal = document.getElementById('downloadModal');
    if (e.target === modal) {
        hideDownloadModal();
    }
}

// 检测用户平台
function detectPlatform() {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform.toLowerCase();
    
    if (platform.includes('mac') || userAgent.includes('mac')) {
        return 'macos';
    } else if (platform.includes('win') || userAgent.includes('win')) {
        return 'windows';
    } else {
        return 'unknown';
    }
}

// 高亮推荐的平台
function highlightRecommendedPlatform() {
    const userPlatform = detectPlatform();
    const platformCards = document.querySelectorAll('.platform-card');
    
    platformCards.forEach(card => {
        const title = card.querySelector('h4').textContent.toLowerCase();
        if (title.includes(userPlatform)) {
            card.style.border = '2px solid var(--primary-orange)';
            card.style.boxShadow = '0 0 20px rgba(249, 115, 22, 0.3)';
            
            // 添加推荐标签
            const recommendedBadge = document.createElement('div');
            recommendedBadge.className = 'recommended-badge';
            recommendedBadge.textContent = '推荐';
            recommendedBadge.style.cssText = `
                position: absolute;
                top: -10px;
                right: -10px;
                background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
                color: white;
                padding: 0.25rem 0.75rem;
                border-radius: 1rem;
                font-size: 0.8rem;
                font-weight: 600;
                z-index: 1;
            `;
            
            card.style.position = 'relative';
            card.appendChild(recommendedBadge);
        }
    });
}

// 添加下载统计
function trackDownload(platform, fileType) {
    // 这里可以添加下载统计逻辑
    console.log(`下载统计: ${platform} - ${fileType}`);
    
    // 可以发送到 Google Analytics 或其他统计服务
    if (typeof gtag !== 'undefined') {
        gtag('event', 'download', {
            'platform': platform,
            'file_type': fileType
        });
    }
}

// 添加下载事件监听
document.addEventListener('DOMContentLoaded', function() {
    // 为下载链接添加点击事件
    const downloadLinks = document.querySelectorAll('.download-option');
    downloadLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const platformCard = this.closest('.platform-card');
            const platform = platformCard.querySelector('h4').textContent;
            const fileType = this.querySelector('.option-name').textContent;
            
            trackDownload(platform, fileType);
            hideDownloadModal();
            
            // 显示下载提示
            showDownloadNotification(fileType);
        });
    });
    
    // 模态框外部点击关闭
    const modal = document.getElementById('downloadModal');
    if (modal) {
        modal.addEventListener('click', handleModalClick);
    }
    
    // 体验浮窗外部点击关闭
    const experienceModal = document.getElementById('experienceModal');
    if (experienceModal) {
        experienceModal.addEventListener('click', handleExperienceModalClick);
    }
    
    // ESC 键关闭所有模态框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideDownloadModal();
            hideExperienceModal();
        }
    });
    
    // 高亮推荐平台
    highlightRecommendedPlatform();
});

// 显示下载通知
function showDownloadNotification(fileType) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, var(--gradient-start), var(--gradient-end));
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 0.5rem;
        box-shadow: 0 4px 20px rgba(249, 115, 22, 0.3);
        z-index: 3000;
        animation: slideInRight 0.3s ease;
    `;
    notification.textContent = `正在下载 ${fileType}...`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 导航栏滚动效果
function handleNavbarScroll() {
    const navbar = document.querySelector('.navbar');
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > 100) {
        navbar.style.background = 'rgba(17, 24, 39, 0.98)';
        navbar.style.backdropFilter = 'blur(20px)';
    } else {
        navbar.style.background = 'rgba(17, 24, 39, 0.95)';
        navbar.style.backdropFilter = 'blur(20px)';
    }
}

// 滚动动画
function handleScrollAnimations() {
    const elements = document.querySelectorAll('.feature-card, .guide-step, .feedback-card');
    
    elements.forEach(element => {
        const elementTop = element.getBoundingClientRect().top;
        const elementVisible = 150;
        
        if (elementTop < window.innerHeight - elementVisible) {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }
    });
}

// 导航链接点击事件
document.addEventListener('DOMContentLoaded', function() {
    // 为所有导航链接添加平滑滚动
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            scrollToSection(targetId);
        });
    });
    
    // 为功能卡片添加悬停效果
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-10px) scale(1.02)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
    
    // 初始化动画元素
    const animatedElements = document.querySelectorAll('.feature-card, .guide-step, .feedback-card');
    animatedElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    });
    
    // 添加滚动事件监听
    window.addEventListener('scroll', function() {
        handleNavbarScroll();
        handleScrollAnimations();
    });
    
    // 添加鼠标移动视差效果
    document.addEventListener('mousemove', function(e) {
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;
        
        const heroVisual = document.querySelector('.hero-visual');
        if (heroVisual) {
            const translateX = (mouseX - 0.5) * 20;
            const translateY = (mouseY - 0.5) * 20;
            heroVisual.style.transform = `perspective(1000px) rotateY(${-translateX * 0.1}deg) rotateX(${translateY * 0.1}deg)`;
        }
    });
    
    // 添加键盘导航支持
    document.addEventListener('keydown', function(e) {
        if (e.key === 'ArrowDown') {
            window.scrollBy({ top: 100, behavior: 'smooth' });
        } else if (e.key === 'ArrowUp') {
            window.scrollBy({ top: -100, behavior: 'smooth' });
        }
    });
    
    // 添加加载动画
    const logoIcon = document.querySelector('.logo-icon');
    if (logoIcon) {
        logoIcon.addEventListener('click', function() {
            this.style.animation = 'none';
            setTimeout(() => {
                this.style.animation = 'pulse 2s infinite';
            }, 10);
        });
    }
    
    // 为按钮添加点击波纹效果
    const buttons = document.querySelectorAll('.primary-btn, .secondary-btn, .github-btn, .feedback-btn');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });
    
    // 添加滚动进度条
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    document.body.appendChild(progressBar);
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / docHeight) * 100;
        progressBar.style.width = scrollPercent + '%';
    });
    
    // 初始化滚动动画
    handleScrollAnimations();
});

// 添加页面可见性变化时的动画控制
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        handleScrollAnimations();
    }
});

// 添加错误处理
window.addEventListener('error', function(e) {
    console.log('页面错误:', e.error);
});

// 添加性能优化：防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 使用防抖优化滚动事件
const debouncedScrollHandler = debounce(function() {
    handleNavbarScroll();
    handleScrollAnimations();
}, 10);

window.addEventListener('scroll', debouncedScrollHandler);