import { Pool } from 'pg'; 
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    // --- 1. БАЗОВІ ПОСЛУГИ ---
    const defaultServices = [
        { name: 'Планове ТО (Технічне обслуговування)', price: 1500, durationMin: 60 },
        { name: 'Повне ТО (Технічне обслуговування)', price: 3000, durationMin: 180 },
        { name: "Комп'ютерна діагностика", price: 500, durationMin: 30 },
        { name: 'Діагностика ходової', price: 800, durationMin: 30 },
        { name: 'Заміна гальмівних колодок (4 колеса)', price: 1300, durationMin: 120 },
        { name: 'Шиномонтаж та балансування (4 колеса)', price: 2000, durationMin: 90 },
        { name: 'Заправка кондиціонера', price: 1500, durationMin: 60 },
        { name: 'Розвал-сходження (3D)', price: 2000, durationMin: 60 },
    ];

    console.log('🔧 Починаємо додавати базові послуги...');

    for (const service of defaultServices) {
        const existingService = await prisma.service.findFirst({
            where: { name: service.name },
        });

        if (!existingService) {
            await prisma.service.create({
                data: service,
            });
            console.log(`✅ Додано нову послугу: ${service.name}`);
        } else {
            console.log(`⏩ Пропущено (вже існує): ${service.name}`);
        }
    }
    console.log('🎉 Базові послуги успішно перевірено/додано!\n');


    // --- 2. БАЗОВІ ЗАПЧАСТИНИ ---
    // Додано обов'язкове поле SKU та початковий Stock
    const defaultParts = [
        { sku: 'OIL-5W30-1L', name: 'Олива моторна 5W-30 (1 л)', price: 350, stock: 50 },
        { sku: 'OIL-5W40-1L', name: 'Олива моторна 5W-40 (1 л)', price: 320, stock: 50 },
        { sku: 'FLT-OIL-001', name: 'Фільтр масляний', price: 400, stock: 50 },
        { sku: 'FLT-AIR-001', name: 'Фільтр повітряний', price: 350, stock: 50 },
        { sku: 'FLT-CAB-CAR', name: 'Фільтр салону (вугільний)', price: 450, stock: 50 },
        { sku: 'BRK-FLD-DT4', name: 'Гальмівна рідина DOT-4 (1 л)', price: 300, stock: 50 },
        { sku: 'ANT-G12-1L',  name: 'Антифриз G12 (1 л)', price: 250, stock: 50 },
        { sku: 'SPK-PLG-001', name: 'Свічка запалювання (1 шт)', price: 300, stock: 50 },
        { sku: 'BRK-PAD-FRT', name: 'Гальмівні колодки (передні, комплект)', price: 1500, stock: 20 },
        { sku: 'BRK-PAD-RER', name: 'Гальмівні колодки (задні, комплект)', price: 1200, stock: 20 },
        { sku: 'WSH-SUM-5L',  name: 'Омивач скла (літо, 5 л)', price: 150, stock: 100 },
        { sku: 'WSH-WIN-5L',  name: 'Омивач скла (зима, 5 л)', price: 250, stock: 100 },
    ];

    console.log('⚙️ Починаємо додавати базові запчастини...');

    for (const part of defaultParts) {
        // Оскільки sku є унікальним, тепер шукаємо саме за ним
        const existingPart = await prisma.part.findUnique({
            where: { sku: part.sku },
        });

        if (!existingPart) {
            await prisma.part.create({
                data: part,
            });
            console.log(`✅ Додано нову запчастину: [${part.sku}] ${part.name}`);
        } else {
            console.log(`⏩ Пропущено (вже існує): [${part.sku}] ${part.name}`);
        }
    }
    console.log('🎉 Базові запчастини успішно перевірено/додано!');
}

main()
    .catch((e) => {
        console.error('❌ Помилка під час сідінгу БД:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });