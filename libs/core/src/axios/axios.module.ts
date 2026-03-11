import { Module } from "@nestjs/common";
import { AxiosService } from "./axios.service";

@Module({
    providers: [AxiosService],
    exports: [AxiosService]
})
export class AxiosModule {
    static forRoot() {
        return {
            module: AxiosModule,
            global: true
        };
    }
}