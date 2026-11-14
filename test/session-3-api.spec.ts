import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { DonorsController } from "../src/presentation/donors/donors.controller";
import { JwtAuthGuard } from "../src/presentation/auth/jwt-auth.guard";
import { CreateDonorUseCase } from "../src/application/donors/create-donor.use-case";
import { GetDonorUseCase } from "../src/application/donors/get-donor.use-case";
import { ListDonorsUseCase } from "../src/application/donors/list-donors.use-case";
import { UpdateDonorUseCase } from "../src/application/donors/update-donor.use-case";
import { DonorNotFoundError, DonorAccessDeniedError } from "../src/application/donors/donor-errors";

describe("Sesión 3 — pruebas HTTP de la API de donantes", () => {
  let app: INestApplication;
  let baseUrl: string;

  const donor = {
    id: "donor-test-1",
    rndCode: "RND-TEST-1",
    status: "EN_VALORACION",
    originatingIpsName: "Hospital de Prueba",
    clinicalService: "UCI Adultos",
    fullName: "Donante Sintético",
    documentNumber: "DOC-TEST-1",
    anthropometry: null,
    bloodGroup: "O",
    rhFactor: "POSITIVO",
    clinicalData: null,
    createdById: "user-test-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  const createDonor = { execute: jest.fn() };
  const getDonor = { execute: jest.fn() };
  const listDonors = { execute: jest.fn() };
  const updateDonor = { execute: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [DonorsController],
      providers: [
        { provide: CreateDonorUseCase, useValue: createDonor },
        { provide: GetDonorUseCase, useValue: getDonor },
        { provide: ListDonorsUseCase, useValue: listDonors },
        { provide: UpdateDonorUseCase, useValue: updateDonor },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => any } }) => {
          context.switchToHttp().getRequest().user = {
            userId: "user-test-1",
            role: "ADMIN",
            institutionalIps: ["Hospital de Prueba"],
          };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.listen(0);
    const address = app.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    createDonor.execute.mockReset();
    getDonor.execute.mockReset();
    listDonors.execute.mockReset();
    updateDonor.execute.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /api/v1/donors crea un expediente y responde 201", async () => {
    createDonor.execute.mockResolvedValue(donor);
    const response = await fetch(`${baseUrl}/api/v1/donors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rndCode: "RND-TEST-1",
        originatingIpsName: "Hospital de Prueba",
        clinicalService: "UCI Adultos",
        fullName: "Donante Sintético",
        documentNumber: "DOC-TEST-1",
      }),
    });

    expect(response.status).toBe(201);
    expect((await response.json()).id).toBe("donor-test-1");
    expect(createDonor.execute).toHaveBeenCalledWith(
      expect.objectContaining({ rndCode: "RND-TEST-1" }),
      "user-test-1",
    );
  });

  it("POST /api/v1/donors rechaza campos obligatorios vacíos con 400", async () => {
    const response = await fetch(`${baseUrl}/api/v1/donors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rndCode: "",
        originatingIpsName: "Hospital de Prueba",
        clinicalService: "UCI Adultos",
        fullName: "Donante Sintético",
        documentNumber: "DOC-TEST-1",
      }),
    });

    expect(response.status).toBe(400);
    expect(createDonor.execute).not.toHaveBeenCalled();
  });

  it("GET /api/v1/donors transforma y valida la paginación", async () => {
    listDonors.execute.mockResolvedValue({ items: [donor], total: 1 });
    const response = await fetch(
      `${baseUrl}/api/v1/donors?page=2&pageSize=10&status=ACTIVO`,
    );

    expect(response.status).toBe(200);
    expect(listDonors.execute).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 10, status: "ACTIVO" }),
      expect.objectContaining({ userId: "user-test-1", role: "ADMIN" }),
    );
  });

  it("GET /api/v1/donors/:id responde 404 cuando el expediente no existe", async () => {
    getDonor.execute.mockRejectedValue(new DonorNotFoundError("missing"));
    const response = await fetch(`${baseUrl}/api/v1/donors/missing`);

    expect(response.status).toBe(404);
  });

  it("PATCH /api/v1/donors/:id responde 403 cuando el usuario no tiene acceso", async () => {
    updateDonor.execute.mockRejectedValue(new DonorAccessDeniedError());
    const response = await fetch(`${baseUrl}/api/v1/donors/donor-test-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ACTIVO" }),
    });

    expect(response.status).toBe(403);
  });
});
