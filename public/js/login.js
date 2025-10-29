// Login page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('form');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    
    form.addEventListener('submit', function(e) {
        // Mostrar loading no botão
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
        
        // Validação básica
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        
        if (!username || !password) {
            e.preventDefault();
            showAlert('Por favor, preencha todos os campos!', 'danger');
            resetButton();
            return;
        }
        
        // Se chegou até aqui, o formulário será enviado
        // O loading será mantido até a resposta do servidor
    });
    
    function resetButton() {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
    
    function showAlert(message, type) {
        // Remove alertas existentes
        const existingAlerts = document.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());
        
        // Cria novo alerta
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} fade-in`;
        alertDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            ${message}
        `;
        
        // Insere antes do formulário
        const form = document.querySelector('form');
        form.parentNode.insertBefore(alertDiv, form);
        
        // Remove após 5 segundos
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }
    
    // Adicionar efeito de foco nos inputs
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
        });
    });
});

