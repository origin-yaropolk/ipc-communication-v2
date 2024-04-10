import { Observable } from "rxjs";

export interface IMyTestService {
    add(a: number, b: number): number;
    greet(): string;
    statusChanged: Observable<number>;
    changeStatus(newNumber: number): void;
}

export interface IMyRendererTestService {
    sub(a: number, b: number): number;
    greet(): string;
    statusChanged: Observable<number>;
    changeStatus(newNumber: number): void;
}

export interface IMySecondRendererTestService {
    mul(a: number, b: number): number;
    greet(): string;
}