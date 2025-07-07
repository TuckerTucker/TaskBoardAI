import { BoardService, ConfigService, ValidationService } from '@core/services';
import { TemplateService } from '@core/services/TemplateService';
import { AuthService } from '@core/services/AuthService';
import { BoardRepository, ConfigRepository, FileSystemRepository } from '@core/repositories';
import { TemplateRepository } from '@core/repositories/TemplateRepository';
import { UserRepository } from '@core/repositories/UserRepository';
import { ObservableLogger, MetricsCollector, PerformanceTracker, HealthChecker } from '@core/utils/observability';
import { ErrorTracker } from '@core/utils/errorTracking';
import { AlertManager } from '@core/utils/alerting';

export class ServiceFactory {
  private static instance: ServiceFactory;
  
  private boardService: BoardService;
  private configService: ConfigService;
  private validationService: ValidationService;
  private templateService: TemplateService;
  private authService: AuthService;
  private observableLogger: ObservableLogger;
  private metricsCollector: MetricsCollector;
  private performanceTracker: PerformanceTracker;
  private healthChecker: HealthChecker;
  private errorTracker: ErrorTracker;
  private alertManager: AlertManager;

  private constructor() {
    this.initializeServices();
  }

  static getInstance(): ServiceFactory {
    if (!ServiceFactory.instance) {
      ServiceFactory.instance = new ServiceFactory();
    }
    return ServiceFactory.instance;
  }

  private initializeServices(): void {
    // Initialize observability services first
    this.observableLogger = ObservableLogger.getInstance();
    this.metricsCollector = MetricsCollector.getInstance();
    this.performanceTracker = PerformanceTracker.getInstance();
    this.healthChecker = HealthChecker.getInstance();
    this.errorTracker = ErrorTracker.getInstance();
    this.alertManager = AlertManager.getInstance();
    
    // Initialize file system and repositories
    const fileSystem = new FileSystemRepository();
    const boardRepository = new BoardRepository(fileSystem);
    const configRepository = new ConfigRepository(fileSystem);
    const templateRepository = new TemplateRepository();
    const userRepository = new UserRepository(fileSystem);
    
    // Initialize services
    this.validationService = new ValidationService();
    this.boardService = new BoardService(boardRepository, this.validationService);
    this.configService = new ConfigService(configRepository, this.validationService);
    this.templateService = new TemplateService(templateRepository, boardRepository);
    this.authService = new AuthService(userRepository, this.validationService);
  }

  getBoardService(): BoardService {
    return this.boardService;
  }

  getConfigService(): ConfigService {
    return this.configService;
  }

  getValidationService(): ValidationService {
    return this.validationService;
  }

  getTemplateService(): TemplateService {
    return this.templateService;
  }

  getAuthService(): AuthService {
    return this.authService;
  }

  getObservableLogger(): ObservableLogger {
    return this.observableLogger;
  }

  getMetricsCollector(): MetricsCollector {
    return this.metricsCollector;
  }

  getPerformanceTracker(): PerformanceTracker {
    return this.performanceTracker;
  }

  getHealthChecker(): HealthChecker {
    return this.healthChecker;
  }

  getErrorTracker(): ErrorTracker {
    return this.errorTracker;
  }

  getAlertManager(): AlertManager {
    return this.alertManager;
  }
}