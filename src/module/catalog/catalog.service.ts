import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';

@Injectable()
export class CatalogService {
    constructor(private prisma: PrismaService) { }

    async getAllServices() {
        return await this.prisma.service.findMany({
            orderBy: { name: "asc" }
        });
    }

    async getAllParts() {
        return await this.prisma.part.findMany({
            orderBy: { name: "asc" },
        });
    }
}