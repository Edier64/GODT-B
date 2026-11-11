import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsNotEmpty, IsString, MaxLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "coordinador@godt.gov.co" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "Debe ingresar un correo institucional válido." })
  @IsNotEmpty({ message: "El correo institucional es obligatorio." })
  @MaxLength(320, { message: "El correo institucional excede la longitud permitida." })
  email!: string;

  @ApiProperty({ example: "••••••••••••" })
  @IsString({ message: "La contraseña debe ser una cadena de texto válida." })
  @IsNotEmpty({ message: "La contraseña es obligatoria." })
  @MaxLength(128, { message: "La contraseña excede la longitud máxima permitida." })
  password!: string;
}
