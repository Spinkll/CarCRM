import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
// MailerService тут не потрібен, тому я його прибрав

@Injectable()
export class CatalogService {
    constructor(private prisma: PrismaService) { }

    async getAllServices() {
        // ДОДАНО return
        return await this.prisma.service.findMany({
            orderBy: { name: "asc" }
        });
    }

    async getAllParts() {
        // ДОДАНО return ТА змінено service на part
        return await this.prisma.part.findMany({
            orderBy: { name: "asc" },
        });
    }
}