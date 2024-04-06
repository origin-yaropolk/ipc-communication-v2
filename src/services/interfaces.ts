interface IMyTestService {
    add(a: number, b: number): number;
    greet(): string;
}

interface IMyRendererTestService {
    sub(a: number, b: number): number;
    greet(): string;
}

interface IMySecondRendererTestService {
    mul(a: number, b: number): number;
    greet(): string;
}