import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class ScriptApiKeyGuard extends AuthGuard('script-api-key') {}
