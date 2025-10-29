require('dotenv').config();
const readlineSync = require('readline-sync');
const InstagramAuth = require('./auth-alternative');

async function testLogin() {
    console.log('🧪 TESTE DE LOGIN - Instagram API');
    console.log('=' .repeat(50));
    
    // Obter credenciais
    let username = process.env.INSTAGRAM_USERNAME;
    let password = process.env.INSTAGRAM_PASSWORD;
    
    if (!username || !password) {
        console.log('📝 Digite suas credenciais:');
        username = readlineSync.question('Username: ');
        password = readlineSync.question('Password: ', { hideEchoBack: true });
    }
    
    console.log(`\n🔄 Testando login para: ${username}`);
    console.log('⏳ Aguarde, testando múltiplas estratégias...\n');
    
    const auth = new InstagramAuth();
    
    try {
        const result = await auth.login(username, password);
        
        if (result.success) {
            console.log('\n🎉 LOGIN REALIZADO COM SUCESSO!');
            console.log('✅ A aplicação deve funcionar normalmente agora.');
            
            // Testar se consegue buscar informações
            try {
                const user = await auth.getIgClient().account.currentUser();
                console.log(`👤 Logado como: ${user.full_name} (@${user.username})`);
            } catch (error) {
                console.log('⚠️ Login ok, mas erro ao buscar dados:', error.message);
            }
            
        } else {
            console.log('\n❌ FALHA NO LOGIN');
            console.log('📋 Erro:', result.error);
            console.log('💬 Mensagem:', result.message);
        }
        
    } catch (error) {
        console.log('\n💥 ERRO INESPERADO:', error.message);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('🏁 Teste finalizado.');
}

// Executar teste
testLogin().catch(console.error);

