namespace Dean.Api.Kernel.Integrations;

public sealed record SourceBinding(Guid UniversityId, string Capability, string SourceId, string AdapterId, string OptionsSection);
public interface ISourceAdapter
{
    string AdapterId
    {
        get;
    }
    string Capability
    {
        get;
    }
}
public sealed class SourceRegistry
{
    private readonly SourceBinding[] bindings;
    private readonly ISourceAdapter[] adapters;
    public SourceRegistry(IEnumerable<SourceBinding> bindings, IEnumerable<ISourceAdapter> adapters)
    {
        this.bindings = bindings.ToArray();
        this.adapters = adapters.ToArray();
        if (this.bindings.Any(x => x.UniversityId == Guid.Empty || new[] { x.Capability, x.SourceId, x.AdapterId, x.OptionsSection }.Any(string.IsNullOrWhiteSpace)))
            throw new InvalidOperationException("Invalid source binding.");
        if (this.bindings.DistinctBy(x => (x.UniversityId, x.Capability, x.SourceId)).Count() != this.bindings.Length ||
            this.adapters.DistinctBy(x => (x.AdapterId, x.Capability)).Count() != this.adapters.Length)
            throw new InvalidOperationException("Duplicate source binding or adapter.");
        foreach (var binding in this.bindings)
            Resolve(binding);
    }
    public SourceBinding Get(Guid universityId, string capability, string sourceId) => bindings.SingleOrDefault(x =>
        x.UniversityId == universityId && x.Capability == capability && x.SourceId == sourceId) ?? throw new KeyNotFoundException("Source is not registered.");
    public ISourceAdapter Resolve(SourceBinding binding)
    {
        if (!bindings.Contains(binding))
            throw new KeyNotFoundException("Source is not registered.");
        return adapters.SingleOrDefault(x => x.AdapterId == binding.AdapterId && x.Capability == binding.Capability)
            ?? throw new InvalidOperationException("Adapter is not registered.");
    }
}

// Source ID is local to a university; external IDs are never global IDs or names.
public sealed record ExternalIdentity(Guid UniversityId, string SourceId, string ExternalId);
public sealed record SourceRecord<T>(string ExternalId, T Value);
public interface IExternalSource<T>
{
    Task<IReadOnlyList<SourceRecord<T>>> Fetch(SourceBinding binding, CancellationToken ct);
}
public interface IRecordInterpreter<TRaw, TCanonical>
{
    Task<TCanonical> Interpret(SourceBinding binding, SourceRecord<TRaw> record, CancellationToken ct);
}
public sealed record InterpretedRecord<T>(ExternalIdentity Identity, T Value);
public interface IImportApplier<T>
{
    // One bounded batch, one transaction. Upsert by ExternalIdentity. No deletion by absence.
    Task Apply(SourceBinding binding, IReadOnlyList<InterpretedRecord<T>> records, CancellationToken ct);
}
public enum ImportStatus
{
    Succeeded, FetchFailed, InterpretationFailed, ApplyFailed, Cancelled
}
public sealed record ImportResult(ImportStatus Status, int Received, int Applied, string? ErrorCode);

// In-process executor only: no scheduling, network transport or persistence assumptions.
public sealed class ImportPipeline<TRaw, TCanonical>(IExternalSource<TRaw> source, IRecordInterpreter<TRaw, TCanonical> interpreter, IImportApplier<TCanonical> applier)
{
    public async Task<ImportResult> Run(SourceBinding binding, int maxBatchSize, TimeSpan timeout, CancellationToken ct = default)
    {
        if (maxBatchSize <= 0 || timeout <= TimeSpan.Zero)
            throw new ArgumentOutOfRangeException(nameof(maxBatchSize));
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct);
        deadline.CancelAfter(timeout);
        var token = deadline.Token;
        var stage = ImportStatus.FetchFailed;
        var received = 0;
        try
        {
            token.ThrowIfCancellationRequested();
            var raw = await source.Fetch(binding, token);
            received = raw.Count;
            stage = ImportStatus.InterpretationFailed;
            if (received > maxBatchSize || raw.Any(x => string.IsNullOrWhiteSpace(x.ExternalId)) || raw.DistinctBy(x => x.ExternalId).Count() != received)
                return new(stage, received, 0, "invalid_batch");
            var records = new List<InterpretedRecord<TCanonical>>();
            foreach (var record in raw)
            {
                token.ThrowIfCancellationRequested();
                records.Add(new(new(binding.UniversityId, binding.SourceId, record.ExternalId), await interpreter.Interpret(binding, record, token)));
            }
            stage = ImportStatus.ApplyFailed;
            token.ThrowIfCancellationRequested();
            await applier.Apply(binding, records, token);
            return new(ImportStatus.Succeeded, received, received, null);
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested)
        {
            return new(ImportStatus.Cancelled, received, 0, ct.IsCancellationRequested ? "cancelled" : "source_timeout");
        }
        catch (Exception)
        {
            return new(stage, received, 0, stage switch
            {
                ImportStatus.FetchFailed => "source_unavailable",
                ImportStatus.InterpretationFailed => "invalid_source_record",
                _ => "apply_failed"
            });
        }
    }
}
