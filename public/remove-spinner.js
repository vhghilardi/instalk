// Script para REMOVER DEFINITIVAMENTE o spinner
// Este script é executado automaticamente

(function() {
    console.log('🔥 INICIANDO REMOÇÃO FORÇADA DO SPINNER...');
    
    // Função para forçar remoção
    function forceRemoveSpinner() {
        // 1. Remover loadingOverlay
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.remove();
            console.log('✅ loadingOverlay REMOVIDO');
        }
        
        // 2. Esconder TODOS os spinners
        const spinners = document.querySelectorAll('.spinner-border, .spinner-grow, .spinner, [class*="loading"], [id*="loading"]');
        spinners.forEach((el, index) => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
            el.style.zIndex = '-9999';
            console.log(`✅ Spinner ${index + 1} escondido`);
        });
        
        // 3. Garantir que o body esteja normal
        document.body.style.overflow = 'auto';
        document.body.style.pointerEvents = 'auto';
        
        // 4. Renderizar interface básica se não existir
        const container = document.getElementById('instancesList');
        if (container && container.innerHTML.trim() === '') {
            container.innerHTML = `
                <div class="col-12">
                    <div class="card text-center py-5">
                        <div class="card-body">
                            <i class="fas fa-plus-circle fa-3x text-muted mb-3"></i>
                            <h5 class="card-title">Nenhuma instância criada</h5>
                            <p class="card-text">Clique no botão "Nova Instância" para começar</p>
                            <button class="btn btn-primary" onclick="showCreateInstanceModal()">
                                <i class="fas fa-plus"></i> Nova Instância
                            </button>
                        </div>
                    </div>
                </div>
            `;
            console.log('✅ Interface básica renderizada');
        }
        
        // 5. Atualizar estatísticas
        const totalEl = document.getElementById('totalInstances');
        const connectedEl = document.getElementById('connectedInstances');
        const disconnectedEl = document.getElementById('disconnectedInstances');
        
        if (totalEl) totalEl.textContent = '0';
        if (connectedEl) connectedEl.textContent = '0';
        if (disconnectedEl) disconnectedEl.textContent = '0';
        
        console.log('🎉 SPINNER REMOVIDO COM SUCESSO!');
    }
    
    // Executar imediatamente
    forceRemoveSpinner();
    
    // Executar novamente após 1 segundo
    setTimeout(forceRemoveSpinner, 1000);
    
    // Executar novamente após 3 segundos
    setTimeout(forceRemoveSpinner, 3000);
    
    // Executar novamente após 5 segundos
    setTimeout(forceRemoveSpinner, 5000);
    
    console.log('✅ Script de remoção do spinner carregado e executado!');
})();
