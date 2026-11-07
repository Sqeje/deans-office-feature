using Dean.Api.Kernel.Integrations;
using Xunit;

public sealed class ImportTests
{
    [Fact]
    public async Task PipelineUpsertsAndDoesNotApplyInvalidOrUnavailableBatches()
    {
        var fake = new Fake();
        var binding = new SourceBinding(Guid.NewGuid(), "schedule", "demo", "fake", "Sources:Demo");
        var pipeline = new ImportPipeline<string, int>(fake, fake, fake);
        Assert.Equal(ImportStatus.Succeeded, (await pipeline.Run(binding, 10, TimeSpan.FromSeconds(1))).Status);
        await pipeline.Run(binding, 10, TimeSpan.FromSeconds(1));
        Assert.Single(fake.Saved);
        fake.Raw = [new("1", "12"), new("2", "unknown-group")];
        Assert.Equal(ImportStatus.InterpretationFailed, (await pipeline.Run(binding, 10, TimeSpan.FromSeconds(1))).Status);
        Assert.Equal(42, Assert.Single(fake.Saved).Value);
        fake.FailFetch = true;
        var failure = await pipeline.Run(binding, 10, TimeSpan.FromSeconds(1));
        Assert.Equal(ImportStatus.FetchFailed, failure.Status);
        Assert.DoesNotContain("secret", failure.ErrorCode!);
        Assert.Single(fake.Saved);
        using var cts = new CancellationTokenSource();
        cts.Cancel();
        Assert.Equal(ImportStatus.Cancelled, (await pipeline.Run(binding, 10, TimeSpan.FromSeconds(1), cts.Token)).Status);
        fake.FailFetch = false;
        fake.Raw = [new("1", "1"), new("1", "2")];
        Assert.Equal("invalid_batch", (await pipeline.Run(binding, 10, TimeSpan.FromSeconds(1))).ErrorCode);
        fake.Raw = []; // Absence is not deletion.
        await pipeline.Run(binding, 10, TimeSpan.FromSeconds(1));
        Assert.Single(fake.Saved);
    }
    [Fact]
    public async Task ApplyFailuresAndTimeoutsAreDistinct()
    {
        var fake = new Fake { FailApply = true };
        var pipeline = new ImportPipeline<string, int>(fake, fake, fake);
        var binding = new SourceBinding(Guid.NewGuid(), "schedule", "demo", "fake", "Sources:Demo");
        Assert.Equal(ImportStatus.ApplyFailed, (await pipeline.Run(binding, 10, TimeSpan.FromSeconds(1))).Status);
        fake.Delay = true;
        var timeout = await pipeline.Run(binding, 10, TimeSpan.FromMilliseconds(20));
        Assert.Equal("source_timeout", timeout.ErrorCode);
    }
    private sealed class Fake : IExternalSource<string>, IRecordInterpreter<string, int>, IImportApplier<int>
    {
        public IReadOnlyList<SourceRecord<string>> Raw = [new("1", "42")];
        public Dictionary<ExternalIdentity, int> Saved = [];
        public bool FailFetch, FailApply, Delay;
        public async Task<IReadOnlyList<SourceRecord<string>>> Fetch(SourceBinding binding, CancellationToken ct)
        {
            if (Delay)
                await Task.Delay(1000, ct);
            if (FailFetch)
                throw new Exception("secret-url-and-password");
            return Raw;
        }
        public Task<int> Interpret(SourceBinding binding, SourceRecord<string> record, CancellationToken ct) => Task.FromResult(int.Parse(record.Value));
        public Task Apply(SourceBinding binding, IReadOnlyList<InterpretedRecord<int>> records, CancellationToken ct)
        {
            if (FailApply)
                throw new Exception("secret");
            foreach (var record in records)
                Saved[record.Identity] = record.Value;
            return Task.CompletedTask;
        }
    }
}
