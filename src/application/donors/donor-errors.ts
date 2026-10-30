export class DonorNotFoundError extends Error {
  constructor(id: string) {
    super(`Donor record ${id} was not found`);
    this.name = "DonorNotFoundError";
  }
}

export class DuplicateRndCodeError extends Error {
  constructor(rndCode: string) {
    super(`RND code ${rndCode} is already registered`);
    this.name = "DuplicateRndCodeError";
  }
}

export class DonorAccessDeniedError extends Error {
  constructor() {
    super("The current user cannot access this donor record");
    this.name = "DonorAccessDeniedError";
  }
}
