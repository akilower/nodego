const fs = require('fs');
const axios = require('axios');
const colors = require('colors');
const { HttpsProxyAgent } = require('https-proxy-agent');

class NodeGo {
    constructor() {
        this.apiBaseUrl = 'https://nodego.ai/api';
        this.isRunning = true;
        this.accounts = this.loadAccounts();
        this.tasksList = [
            { code: 'T001', name: 'Verify Email' },
            { code: 'T002', name: 'Join Telegram Channel' },
            { code: 'T003', name: 'Join Telegram Group' },
            { code: 'T004', name: 'Boost Telegram Channel' },
            { code: 'T005', name: 'Follow us on X' },
            { code: 'T006', name: 'Rate Chrome Extension' },
            { code: 'T007', name: 'Join Telegram MiniApp' },
            { code: 'T009', name: 'Join Discord Channel' },
            { code: 'T010', name: 'Add NodeGo.Ai to your name' },
            { code: 'T011', name: 'Share Your Referral Link on X' },
            { code: 'T012', name: 'Retweet & Like US' },
            { code: 'T014', name: 'Comment on our post & Tag 3 friends' },
            { code: 'T100', name: 'Invite 1 friend' },
            { code: 'T101', name: 'Invite 3 friends' },
            { code: 'T102', name: 'Invite 5 friends' },
            { code: 'T103', name: 'Invite 10 friends' }
        ];
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [✓] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`.magenta);
                break;        
            case 'error':
                console.log(`[${timestamp}] [✗] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [!] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [ℹ] ${msg}`.blue);
        }
    }

    loadAccounts() {
        try {
            const accountData = fs.readFileSync('data.txt', 'utf8')
                .split('\n')
                .filter(line => line.trim());
            
            const proxyData = fs.existsSync('proxy.txt') 
                ? fs.readFileSync('proxy.txt', 'utf8')
                    .split('\n')
                    .filter(line => line.trim())
                : [];
            
            return accountData.map((token, index) => ({
                token: token.trim(),
                proxy: proxyData[index] || null,
                lastPingTimestamp: 0
            }));
        } catch (error) {
            this.log(`Error reading account data: ${error}`, 'error');
            process.exit(1);
        }
    }

    async makeRequest(token, endpoint, method, data = null, proxyUrl = null) {
        const config = {
            method,
            url: `${this.apiBaseUrl}${endpoint}`,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': '*/*'
            },
            ...(data && { data }),
            timeout: 30000
        };

        if (proxyUrl) {
            config.httpsAgent = new HttpsProxyAgent(proxyUrl);
        }

        try {
            return await axios(config);
        } catch (error) {
            if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
                throw new Error(`Connection failed: ${error.message}`);
            }
            throw error;
        }
    }

    async getUserInfo(token, proxy) {
        try {
            const response = await this.makeRequest(token, '/user/me', 'GET', null, proxy);
            const metadata = response.data.metadata;
            return {
                username: metadata.username,
                email: metadata.email,
                totalPoint: metadata.rewardPoint,
                socialTasks: metadata.socialTask || [],
                nodes: metadata.nodes.map(node => ({
                    id: node.id,
                    totalPoint: node.totalPoint,
                    todayPoint: node.todayPoint,
                    isActive: node.isActive
                }))
            };
        } catch (error) {
            this.log(`Failed to fetch user info: ${error.message}`, 'error');
            throw error;
        }
    }

    async ping(account) {
        try {
            const currentTime = Date.now();
            
            if (currentTime - account.lastPingTimestamp < 3000) {
                await new Promise(resolve => setTimeout(resolve, 3000 - (currentTime - account.lastPingTimestamp)));
            }

            const response = await this.makeRequest(
                account.token,
                '/user/nodes/ping',
                'POST',
                { type: 'extension' },
                account.proxy
            );
            
            account.lastPingTimestamp = Date.now();
            
            return {
                statusCode: response.data.statusCode,
                message: response.data.message,
                metadataId: response.data.metadata.id
            };
        } catch (error) {
            this.log(`Ping failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async dailyCheckin(token, proxy) {
        try {
            const response = await this.makeRequest(token, '/user/checkin', 'POST', null, proxy);
            return {
                statusCode: response.data.statusCode,
                message: response.data.message,
                userData: response.data.metadata.user
            };
        } catch (error) {
            const statusCode = error.response?.data?.statusCode || error.response?.status || 500;
            const message = error.response?.data?.message || error.message;
            throw {
                statusCode,
                message,
                error: true
            };
        }
    }

    async start() {
        process.on('SIGINT', () => {
            this.log('\nStopping script...', 'warning');
            this.isRunning = false;
            setTimeout(() => process.exit(0), 1000);
        });

        this.log('\n🚀 Starting Airdrop Worker...', 'warning');
        for (const account of this.accounts) {
            if (!this.isRunning) break;
            await this.processInitialTasks(account);
        }

        this.log('\n⚡ Starting Ping...', 'warning');
        while (this.isRunning) {
            this.log(`\n⏰ Ping starts at ${new Date().toLocaleString()}`);
            
            for (const account of this.accounts) {
                if (!this.isRunning) break;
                await this.processPingForAccount(account);
            }

            if (this.isRunning) {
                this.log('\nWaiting 20 seconds before the next loop...', 'info');
                await new Promise(resolve => setTimeout(resolve, 20000));
            }
        }
    }
}

const pinger = new NodeGo();
pinger.start();