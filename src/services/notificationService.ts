class NotificationService {
  private container: HTMLElement | null = null;

  init(): void {
    this.container = document.createElement('div');
    this.container.id = 'notification-container';
    this.container.className = 'notification-container';
    document.body.appendChild(this.container);
  }

  show(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000): void {
    if (!this.container) this.init();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <span>${message}</span>
      <button class="notification-close">&times;</button>
    `;

    const closeBtn = notification.querySelector('.notification-close') as HTMLElement;
    closeBtn.addEventListener('click', () => this.remove(notification));

    this.container!.appendChild(notification);

    // Auto remove
    setTimeout(() => this.remove(notification), duration);

    // Animate in
    requestAnimationFrame(() => {
      notification.classList.add('notification-show');
    });
  }

  private remove(notification: HTMLElement): void {
    notification.classList.remove('notification-show');
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error', 5000);
  }

  info(message: string): void {
    this.show(message, 'info');
  }
}

export const notificationService = new NotificationService();
</boltService>